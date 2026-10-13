import { randomUUID } from "node:crypto";
import { WellnessService, defaultWellnessSchedule, type WellnessSchedule } from "./wellness.service.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JournalService } from "../journals/journals.service.js";
import type { EncryptionService } from "../../infrastructure/encryption/encryption.service.js";
import { encryptText, decryptText } from "../../infrastructure/encryption/encryption.service.js";
import { logSupabaseError, type SupabaseOperation } from "../../infrastructure/supabase/supabase-diagnostics.js";
import { ConflictError, ExternalServiceError, NotFoundError } from "../../shared/errors/app-error.js";

type DatabaseRow = Record<string, unknown>;

const moodScores: Record<string, number> = {
  calm: 82,
  happy: 92,
  neutral: 62,
  sad: 38,
  anxious: 32,
  angry: 26,
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function hasReviewableSource(row: DatabaseRow): boolean {
  const source = asString(row.verification_source);
  const checkedAt = asString(row.last_verified_at);
  try {
    const url = new URL(source);
    return url.protocol === "https:"
      && Boolean(url.hostname)
      && !url.username
      && !url.password
      && checkedAt.length > 0
      && !Number.isNaN(Date.parse(checkedAt))
      && Date.parse(checkedAt) <= Date.now();
  } catch {
    return false;
  }
}

function databaseError(message: string): ExternalServiceError {
  return new ExternalServiceError("DATABASE_UNAVAILABLE", message);
}

function throwIfDatabaseError(error: unknown, operation: SupabaseOperation, message: string): void {
  if (!error) return;
  logSupabaseError(operation, error as Parameters<typeof logSupabaseError>[1]);
  throw databaseError(message);
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function dateKey(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function calculateStreak(entries: Array<{ created_at: string }>): number {
  const dates = new Set(entries.map((entry) => dateKey(entry.created_at)));
  const cursor = startOfUtcDay(new Date());
  if (!dates.has(dateKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let streak = 0;
  while (dates.has(dateKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function buddyReply(message: string, urgent: boolean): string {
  if (urgent) {
    return "Thank you for telling me. Your immediate safety matters most. Please open Find help or Crisis support now and contact a trusted person who can stay with you.";
  }
  const normalized = message.toLowerCase();
  if (normalized.includes("anx") || normalized.includes("overwhelm") || normalized.includes("tight")) {
    return "Let us make this moment smaller. Place both feet down, take one unforced breath, and name one thing around you that feels steady.";
  }
  if (normalized.includes("sad") || normalized.includes("alone") || normalized.includes("lonely")) {
    return "That sounds heavy to carry alone. What is one gentle thing you need most right now: rest, company, space, or a practical next step?";
  }
  if (normalized.includes("angry") || normalized.includes("frustrat")) {
    return "There is room for that frustration here. Before deciding what to do, can you name what boundary or need feels most important underneath it?";
  }
  return "I am here with you. What part of that feels most present right now, and what would make the next few minutes a little gentler?";
}

function buddyTitle(message: string): string {
  const text = message.toLowerCase();
  if (/\b(overwhelmed?|anxious|anxiety|stressed?|tense)\b/.test(text)) return "Feeling overwhelmed today";
  if (/\b(sleep|tired|rest|insomnia)\b/.test(text)) return "Finding rest today";
  if (/\b(sad|lonely|alone|grief)\b/.test(text)) return "Working through a hard day";
  if (/\b(angry|frustrated?|frustration)\b/.test(text)) return "Working through frustration";
  return "A conversation with Buddy";
}

function searchWords(value: string): string[] {
  return [...new Set(value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].slice(0, 256);
}

export class ExperienceService {
  readonly wellness: WellnessService;
  constructor(
    private readonly database: SupabaseClient,
    private readonly journals: JournalService,
    private readonly encryption: EncryptionService,
    schedule: WellnessSchedule = defaultWellnessSchedule,
    private readonly userDatabase?: () => SupabaseClient,
  ) { this.wellness = new WellnessService(database, schedule, encryption); }

  private get reader(): SupabaseClient { return this.userDatabase?.() ?? this.database; }

  private async historyEnabled(userId: string): Promise<boolean> {
    const { data, error } = await this.reader.schema("user_service").from("privacy_preferences")
      .select("buddy_history_enabled").eq("user_id", userId).maybeSingle();
    if (error) throw databaseError("Buddy privacy settings could not be loaded.");
    return data?.buddy_history_enabled !== false;
  }

  async buddyPrivacy(userId: string) {
    return { buddyHistoryEnabled: await this.historyEnabled(userId) };
  }

  private titleOf(row: DatabaseRow): string {
    return row.title_ciphertext
      ? decryptText(row.title_ciphertext, this.encryption)
      : asString(row.title, "Buddy conversation");
  }

  private conversationSummary(row: DatabaseRow) {
    return {
      id: asString(row.id), title: this.titleOf(row),
      preview: row.preview_ciphertext ? decryptText(row.preview_ciphertext, this.encryption) : "",
      pinned_at: row.pinned_at ?? null,
      last_message_at: row.last_message_at ?? null,
      created_at: row.created_at,
    };
  }

  async dashboard(userId: string, range = "7d") {
    const [entries, analysisInsights, profileResult, preferenceResult] = await Promise.all([
      this.journals.listSummaries(userId),
      this.journals.dashboardInsights(userId),
      this.reader.schema("user_service").from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
      this.reader
        .schema("user_service")
        .from("notification_preferences")
        .select("reminder_time")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    throwIfDatabaseError(
      profileResult.error,
      {
        module: "experience.dashboard",
        schema: "user_service",
        table: "profiles",
        operation: "select dashboard profile",
      },
      "Your dashboard is temporarily unavailable.",
    );
    throwIfDatabaseError(
      preferenceResult.error,
      {
        module: "experience.dashboard",
        schema: "user_service",
        table: "notification_preferences",
        operation: "select dashboard notification preferences",
      },
      "Your dashboard is temporarily unavailable.",
    );
    const profile = profileResult.data;
    const preferences = preferenceResult.data;
    const recentTitles = await this.journals.getJournalTitles(userId, entries.slice(0, 3).map((entry) => entry.id));

    const today = startOfUtcDay(new Date());
    let moodTrend: Array<{ label: string; value: number }>;

    if (range === "30d" || range === "month") {
      // 4 clean weekly buckets over the 30-day period
      moodTrend = Array.from({ length: 4 }, (_, index) => {
        const weekEnd = new Date(today);
        weekEnd.setUTCDate(weekEnd.getUTCDate() - (3 - index) * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setUTCDate(weekStart.getUTCDate() - 6);
        const matching = entries.filter((entry) => {
          const entryDate = new Date(entry.created_at);
          return entryDate >= weekStart && entryDate <= weekEnd;
        });
        const value = matching.length
          ? Math.round(matching.reduce((sum, entry) => sum + (moodScores[entry.mood] ?? 60), 0) / matching.length)
          : 0;
        return { label: `Week ${index + 1}`, value };
      });
    } else if (range === "90d") {
      // 3 monthly intervals over 90 days
      moodTrend = Array.from({ length: 3 }, (_, index) => {
        const periodEnd = new Date(today);
        periodEnd.setUTCDate(periodEnd.getUTCDate() - (2 - index) * 30);
        const periodStart = new Date(periodEnd);
        periodStart.setUTCDate(periodStart.getUTCDate() - 29);
        const matching = entries.filter((entry) => {
          const entryDate = new Date(entry.created_at);
          return entryDate >= periodStart && entryDate <= periodEnd;
        });
        const value = matching.length
          ? Math.round(matching.reduce((sum, entry) => sum + (moodScores[entry.mood] ?? 60), 0) / matching.length)
          : 0;
        const monthLabel = periodEnd.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
        return { label: monthLabel, value };
      });
    } else {
      moodTrend = Array.from({ length: 7 }, (_, index) => {
        const day = new Date(today);
        day.setUTCDate(day.getUTCDate() - (6 - index));
        const matching = entries.filter((entry) => dateKey(entry.created_at) === dateKey(day));
        const value = matching.length
          ? Math.round(matching.reduce((sum, entry) => sum + (moodScores[entry.mood] ?? 60), 0) / matching.length)
          : 0;
        return { label: day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }), value };
      });
    }

    const moodCounts = new Map<string, number>();
    for (const entry of entries) moodCounts.set(entry.mood, (moodCounts.get(entry.mood) ?? 0) + 1);
    const topMood = [...moodCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "calm";
    const weeklyDigest = entries.length
      ? [
          `You kept ${entries.length} private reflection${entries.length === 1 ? "" : "s"} close.`,
          `${topMood[0]?.toUpperCase() ?? ""}${topMood.slice(1)} appeared most often in your recent entries.`,
          entries.some((entry) => entry.tags.length > 0)
            ? "Your saved tags can help you revisit recurring themes."
            : "Adding a small tag can make recurring themes easier to revisit.",
        ]
      : [
          "Your reflection space is ready when you are.",
          "A few honest words are enough for a first entry.",
          "Your entries remain private by design.",
        ];

    return {
      userProfile: {
        name: asString((profile as DatabaseRow | null)?.display_name, "Friend"),
        streakDays: calculateStreak(entries),
        nextCheckIn: asString((preferences as DatabaseRow | null)?.reminder_time, "Whenever you are ready"),
        privacyStatus: "Private",
      },
      latestEntry: entries[0] ? { ...entries[0], title: recentTitles.get(entries[0].id) ?? "" } : null,
      journalEntries: entries.map((entry) => ({ ...entry, title: recentTitles.get(entry.id) ?? "" })),
      analysisInsights,
      moodTrend,
      riskTrend: [],
      weeklyDigest,
      quickActions: [
        { href: "/journal/new", title: "Write a reflection", description: "Private journal entry" },
        { href: "/buddy", title: "Talk with Buddy", description: "Gentle check-in conversation" },
        { href: "/tools/grounding", title: "Grounding exercise", description: "Breathing or sensory" },
        { href: "/insights/emotion", title: "Review patterns", description: "Mood and emotion trends" },
      ],
    };
  }

  private messageContent(row: DatabaseRow): string {
    return decryptText(row.content, this.encryption);
  }

  async createBuddyConversation(userId: string) {
    if (!(await this.historyEnabled(userId))) throw new ConflictError("BUDDY_HISTORY_DISABLED", "Turn on Save Buddy history to create a saved conversation.");
    const title = "Buddy conversation";
    const { data, error } = await this.database.schema("buddy_service").rpc("create_conversation", {
      p_user_id: userId, p_title_ciphertext: encryptText(title, this.encryption),
      p_title_hashes: searchWords(title).map((word) => this.encryption.searchHashes(word)[0]),
    });
    if (error?.message.includes("BUDDY_HISTORY_DISABLED"))
      throw new ConflictError("BUDDY_HISTORY_DISABLED", "Turn on Save Buddy history to create a saved conversation.");
    if (error || !data) throw databaseError("Buddy could not start a conversation.");
    return this.conversationSummary(data as DatabaseRow);
  }

  async renameBuddyConversation(userId: string, conversationId: string, title: string) {
    await this.ownedConversation(userId, conversationId);
    const { data, error } = await this.database.schema("buddy_service").rpc("rename_conversation", {
      p_user_id: userId, p_conversation_id: conversationId,
      p_title_ciphertext: encryptText(title, this.encryption),
      p_title_hashes: searchWords(title).map((word) => this.encryption.searchHashes(word)[0]),
    });
    if (error?.message.includes("BUDDY_NOT_FOUND")) throw new NotFoundError("The Buddy conversation was not found.");
    if (error || !data) throw databaseError("Buddy conversation could not be renamed.");
    return this.conversationSummary(data as DatabaseRow);
  }

  async deleteBuddyConversation(userId: string, conversationId: string) {
    await this.ownedConversation(userId, conversationId);
    const { data, error } = await this.database.schema("buddy_service").from("buddy_conversations")
      .delete().eq("id", conversationId).eq("user_id", userId).select("id").maybeSingle();
    if (error) throw databaseError("Buddy conversation could not be deleted.");
    if (!data) throw new NotFoundError("The Buddy conversation was not found.");
    return { deleted: true };
  }

  async buddySession(userId: string, selectedConversationId?: string) {
    if (!selectedConversationId) {
      return { conversationId: null, persisted: false, messages: [{
        id: "welcome", role: "buddy", content: "I am here with you. What feels most present right now?", timestamp: "Now",
      }] };
    }
    const conversation = await this.ownedConversation(userId, selectedConversationId);
    const conversationId = asString(conversation.id);
    const { data, error } = await this.reader
      .schema("buddy_service")
      .from("buddy_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    throwIfDatabaseError(
      error,
      {
        module: "experience.buddy",
        schema: "buddy_service",
        table: "buddy_messages",
        operation: "select conversation messages",
      },
      "Buddy messages could not be loaded.",
    );
    const messages = ((data ?? []) as DatabaseRow[]).map((row) => ({
      id: asString(row.id),
      role: row.role === "user" ? "user" : "buddy",
      content: this.messageContent(row),
      timestamp: new Date(asString(row.created_at)).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    }));
    if (messages.length === 0) {
      messages.push({
        id: "welcome",
        role: "buddy",
        content: "I am here with you. What feels most present right now?",
        timestamp: "Now",
      });
    }
    return { conversationId, conversation: this.conversationSummary(conversation), messages };
  }

  async sendBuddyMessage(userId: string, content: string, selectedConversationId?: string) {
    const saving = await this.historyEnabled(userId);
    if (!saving && selectedConversationId) throw new ConflictError("BUDDY_HISTORY_DISABLED", "Turn on Save Buddy history to continue a saved conversation.");
    const urgent = /\b(suicide|kill myself|end my life|hurt myself|self harm)\b/i.test(content);
    const reply = buddyReply(content, urgent);
    if (!saving) {
      if (urgent) {
        const { error } = await this.database.schema("user_service").from("audit_events").insert({
          user_id: userId, event_type: "buddy.urgent_language_detected",
          resource_type: "buddy_temporary_session", request_id: randomUUID(),
          metadata: { support_resources_shown: true },
        });
        if (error) throw databaseError("Buddy could not complete the safety check.");
      }
      return { conversationId: null, persisted: false, messages: [
        { id: randomUUID(), role: "user", content, timestamp: new Date().toISOString() },
        { id: randomUUID(), role: "buddy", content: reply, timestamp: new Date().toISOString() },
      ] };
    }
    const conversation = selectedConversationId
      ? await this.ownedConversation(userId, selectedConversationId)
      : await this.ownedConversation(userId, (await this.createBuddyConversation(userId)).id);
    const conversationId = asString(conversation.id);
    const firstMessage = !conversation.last_message_at;
    const generatedTitle = firstMessage && !conversation.title_manual ? buddyTitle(content) : null;
    const { error } = await this.database.schema("buddy_service").rpc("save_exchange", {
      p_user_id: userId, p_conversation_id: conversationId,
      p_user_content: encryptText(content, this.encryption),
      p_buddy_content: encryptText(reply, this.encryption),
      p_urgent: urgent,
      p_preview: encryptText(reply.slice(0, 120), this.encryption),
      p_auto_title: generatedTitle ? encryptText(generatedTitle, this.encryption) : null,
      p_user_hashes: searchWords(content).map((word) => this.encryption.searchHashes(word)[0]),
      p_buddy_hashes: searchWords(reply).map((word) => this.encryption.searchHashes(word)[0]),
      p_title_hashes: generatedTitle ? searchWords(generatedTitle).map((word) => this.encryption.searchHashes(word)[0]) : [],
    });
    if (error?.message.includes("BUDDY_HISTORY_DISABLED"))
      throw new ConflictError("BUDDY_HISTORY_DISABLED", "Turn on Save Buddy history to continue a saved conversation.");
    if (error?.message.includes("BUDDY_NOT_FOUND")) throw new NotFoundError("The Buddy conversation was not found.");
    throwIfDatabaseError(error, {
      module: "experience.buddy", schema: "buddy_service", table: "buddy_messages", operation: "save exchange",
    }, "Buddy could not save this conversation.");
    return this.buddySession(userId, conversationId);
  }

  async emotionInsights(userId: string) {
    const entries = await this.journals.listSummaries(userId);
    const moods = ["calm", "happy", "neutral", "anxious", "sad", "angry"];
    const counts = new Map(moods.map((mood) => [mood, 0]));
    for (const entry of entries) counts.set(entry.mood, (counts.get(entry.mood) ?? 0) + 1);
    const total = Math.max(entries.length, 1);
    const emotionWheel = moods.map((mood) => ({
      label: mood[0].toUpperCase() + mood.slice(1),
      mood,
      value: Math.round(((counts.get(mood) ?? 0) / total) * 100),
    }));
    const today = startOfUtcDay(new Date());
    const moodTrend = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() - (6 - index));
      const matching = entries.filter((entry) => dateKey(entry.created_at) === dateKey(day));
      return {
        label: day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
        value: matching.length
          ? Math.round(matching.reduce((sum, entry) => sum + (moodScores[entry.mood] ?? 60), 0) / matching.length)
          : 0,
      };
    });
    const strongest = [...emotionWheel].sort((a, b) => b.value - a.value)[0];
    return {
      emotionWheel,
      moodTrend,
      summary: entries.length
        ? `${strongest.label} is the most frequent signal across ${entries.length} recent reflection${entries.length === 1 ? "" : "s"}.`
        : "No patterns are shown until you save a reflection.",
    };
  }

  async completeGrounding(userId: string, input: { technique: string; durationSeconds: number; pace: string }) {
    const { data, error } = await this.database
      .schema("grounding_service")
      .from("grounding_sessions")
      .insert({
        user_id: userId,
        exercise_type: input.technique,
        duration_seconds: input.durationSeconds,
        completed: true,
        reflection: input.pace,
        completed_at: new Date().toISOString(),
      })
      .select("id, completed_at")
      .single();
    throwIfDatabaseError(
      error,
      {
        module: "experience.grounding",
        schema: "grounding_service",
        table: "grounding_sessions",
        operation: "insert completed grounding session",
      },
      "The grounding session could not be recorded.",
    );
    if (!data) {
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The grounding session could not be recorded.");
    }
    const { count, error: countError } = await this.reader
      .schema("grounding_service")
      .from("grounding_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("completed", true);
    throwIfDatabaseError(
      countError,
      {
        module: "experience.grounding",
        schema: "grounding_service",
        table: "grounding_sessions",
        operation: "count completed grounding sessions",
      },
      "Grounding history could not be loaded.",
    );
    return { id: data.id, completedAt: data.completed_at, completedSessions: count ?? 1 };
  }

  async groundingHistory(userId: string) {
    const { data, error } = await this.reader
      .schema("grounding_service")
      .from("grounding_sessions")
      .select("id, exercise_type, duration_seconds, reflection, completed_at")
      .eq("user_id", userId)
      .eq("completed", true)
      .order("completed_at", { ascending: false })
      .limit(250);
    throwIfDatabaseError(
      error,
      {
        module: "experience.grounding",
        schema: "grounding_service",
        table: "grounding_sessions",
        operation: "list completed grounding sessions",
      },
      "Grounding history could not be loaded.",
    );
    return (data ?? []).map((row) => ({
      id: row.id,
      type: row.exercise_type,
      duration: row.duration_seconds,
      pace: row.reflection,
      completedAt: row.completed_at,
    }));
  }

  async supportResources(query?: string, type?: string, country = "PH") {
    let builder = this.database
      .schema("grounding_service")
      .from("support_resources")
      .select("*")
      .eq("is_active", true)
      .eq("is_verified", true)
      .eq("country_code", country)
      .order("display_priority", { ascending: true });
    if (type && type !== "all") builder = builder.eq("support_resource_type", type);
    if (query) {
      const safeQuery = query.replace(/[%_,()]/g, " ").trim();
      if (safeQuery) {
        builder = builder.or(
          `organization_name.ilike.%${safeQuery}%,resource_name.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`,
        );
      }
    }
    const { data, error } = await builder;
    throwIfDatabaseError(
      error,
      {
        module: "experience.supportResources",
        schema: "grounding_service",
        table: "support_resources",
        operation: "select verified support resources",
      },
      "Support resources are temporarily unavailable.",
    );
    return ((data ?? []) as DatabaseRow[]).filter(hasReviewableSource).map((row) => ({
      id: asString(row.id),
      type: asString(row.support_resource_type),
      organizationName: asString(row.organization_name),
      name: asString(row.resource_name),
      description: asString(row.description),
      phoneNumber: asString(row.phone_number) || null,
      smsNumber: asString(row.sms_number) || null,
      websiteUrl: asString(row.website_url) || null,
      availability: asString(row.availability_text),
      countryCode: asString(row.country_code),
      regionCode: asString(row.region_code) || null,
      lastVerifiedAt: asString(row.last_verified_at),
      verificationSource: asString(row.verification_source),
    }));
  }

  async buddyHistory(userId: string, options: { page: number; pageSize: number; query: string }) {
    if (options.query) {
      const words = searchWords(options.query);
      if (!words.length) return { conversations: [], total: 0, page: options.page, page_size: options.pageSize, pinsAvailable: true };
      const hashes = words.map((word) => this.encryption.searchHashes(word)[0]);
      const { data, error } = await this.database.schema("buddy_service").rpc("search_history", {
        p_user_id: userId, p_hashes: hashes, p_page: options.page, p_page_size: options.pageSize,
      });
      if (error) throw databaseError("Buddy history could not be searched.");
      const rows = (data ?? []) as DatabaseRow[];
      return { conversations: rows.map((row) => this.conversationSummary(row)),
        total: Number(rows[0]?.total ?? 0), page: options.page, page_size: options.pageSize, pinsAvailable: true };
    }
    const readPage = async (pinsAvailable: boolean) => {
      let request = this.reader
        .schema("buddy_service")
        .from("buddy_conversations")
        .select(pinsAvailable
          ? "id, title, title_ciphertext, preview_ciphertext, archived, pinned_at, last_message_at, created_at"
          : "id, title, title_ciphertext, preview_ciphertext, archived, last_message_at, created_at", { count: "exact" })
        .eq("user_id", userId);
      if (pinsAvailable) request = request.order("pinned_at", { ascending: false, nullsFirst: false });
      return request
        .order("last_message_at", { ascending: false })
        .order("id", { ascending: false })
        .range((options.page - 1) * options.pageSize, options.page * options.pageSize - 1);
    };
    let pinsAvailable = true;
    let { data, count, error } = await readPage(true);
    // shortcut: keep history readable before the pin migration; remove this fallback once every database has it.
    if (error?.code === "42703" && error.message.includes("pinned_at")) {
      pinsAvailable = false;
      ({ data, count, error } = await readPage(false));
    }
    throwIfDatabaseError(
      error,
      {
        module: "experience.buddy",
        schema: "buddy_service",
        table: "buddy_conversations",
        operation: "select conversation history",
      },
      "Buddy history could not be loaded.",
    );
    return { conversations: ((data ?? []) as unknown as DatabaseRow[]).map((row) => this.conversationSummary(row)), total: count ?? 0, page: options.page, page_size: options.pageSize, pinsAvailable };
  }

  private async ownedConversation(userId: string, conversationId: string): Promise<DatabaseRow> {
    const { data, error } = await this.reader.schema("buddy_service").from("buddy_conversations")
      .select("*").eq("id", conversationId).eq("user_id", userId).maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Buddy conversation could not be loaded.");
    if (!data) throw new NotFoundError("The Buddy conversation was not found.");
    return data as DatabaseRow;
  }

  async pinBuddyConversation(userId: string, conversationId: string, pinned: boolean) {
    const { data, error } = await this.database.schema("buddy_service").from("buddy_conversations")
      .update({ pinned_at: pinned ? new Date().toISOString() : null })
      .eq("id", conversationId).eq("user_id", userId)
      .select("id,pinned_at").maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Buddy conversation could not be updated.");
    if (!data) throw new NotFoundError("The Buddy conversation was not found.");
    return data;
  }

  async ensureOwnedConversation(userId: string, conversationId: string) {
    const { data, error } = await this.reader
      .schema("buddy_service")
      .from("buddy_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    throwIfDatabaseError(
      error,
      {
        module: "experience.buddy",
        schema: "buddy_service",
        table: "buddy_conversations",
        operation: "select owned conversation",
      },
      "Buddy is temporarily unavailable.",
    );
    if (!data) throw new NotFoundError("The Buddy conversation was not found.");
  }
}
