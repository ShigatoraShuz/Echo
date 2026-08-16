import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JournalService } from "../journals/journals.service.js";
import type { EncryptionService, EncryptedPayload } from "../../infrastructure/encryption/encryption.service.js";
import { ExternalServiceError, NotFoundError } from "../../shared/errors/app-error.js";

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

function bytea(value: string): string {
  return `\\x${Buffer.from(value, "base64").toString("hex")}`;
}

function base64FromBytea(value: unknown): string {
  if (typeof value !== "string") throw new Error("Encrypted conversation data is invalid.");
  return value.startsWith("\\x")
    ? Buffer.from(value.slice(2), "hex").toString("base64")
    : value;
}

function toEncryptedColumns(payload: EncryptedPayload) {
  return {
    content_ciphertext: bytea(payload.ciphertext),
    encryption_iv: bytea(payload.iv),
    encryption_auth_tag: bytea(payload.authenticationTag),
    encryption_key_version: payload.keyVersion,
  };
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

export class ExperienceService {
  constructor(
    private readonly database: SupabaseClient,
    private readonly journals: JournalService,
    private readonly encryption: EncryptionService,
  ) {}

  async dashboard(userId: string, range = "7d") {
    const [entries, profileResult, preferenceResult] = await Promise.all([
      this.journals.list(userId),
      this.database.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      this.database
        .from("notification_preferences")
        .select("reminder_time")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (profileResult.error || preferenceResult.error) {
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Your dashboard is temporarily unavailable.");
    }

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
        name: asString((profileResult.data as DatabaseRow | null)?.display_name, "Friend"),
        streakDays: calculateStreak(entries),
        nextCheckIn: asString((preferenceResult.data as DatabaseRow | null)?.reminder_time, "Whenever you are ready"),
        privacyStatus: "Private",
      },
      latestEntry: entries[0] ?? null,
      journalEntries: entries,
      moodTrend,
      riskTrend: moodTrend.map((point) => ({ label: point.label, value: Math.max(0, 100 - point.value) })),
      weeklyDigest,
      quickActions: [
        { href: "/journal/new", title: "Write a reflection", description: "Private journal entry" },
        { href: "/buddy", title: "Talk with Buddy", description: "Gentle check-in conversation" },
        { href: "/tools/grounding", title: "Grounding exercise", description: "Breathing or sensory" },
        { href: "/insights/emotion", title: "Review patterns", description: "Mood and emotion trends" },
      ],
    };
  }

  private decryptMessage(row: DatabaseRow): string {
    return this.encryption.decrypt({
      ciphertext: base64FromBytea(row.content_ciphertext),
      iv: base64FromBytea(row.encryption_iv),
      authenticationTag: base64FromBytea(row.encryption_auth_tag),
      keyVersion: Number(row.encryption_key_version),
    });
  }

  private async activeConversation(userId: string): Promise<DatabaseRow> {
    const { data, error } = await this.database
      .from("buddy_conversations")
      .select("*")
      .eq("user_id", userId)
      .eq("conversation_status", "active")
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Buddy is temporarily unavailable.");
    if (data) return data as DatabaseRow;

    const { data: created, error: createError } = await this.database
      .from("buddy_conversations")
      .insert({ user_id: userId, conversation_status: "active" })
      .select("*")
      .single();
    if (createError || !created) {
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Buddy could not start a private conversation.");
    }
    return created as DatabaseRow;
  }

  async buddySession(userId: string) {
    const conversation = await this.activeConversation(userId);
    const conversationId = asString(conversation.id);
    const { data, error } = await this.database
      .from("buddy_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Buddy messages could not be loaded.");
    const messages = ((data ?? []) as DatabaseRow[]).map((row) => ({
      id: asString(row.id),
      role: row.message_role === "user" ? "user" : "buddy",
      content: this.decryptMessage(row),
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
    return { conversationId, messages };
  }

  async sendBuddyMessage(userId: string, content: string) {
    const conversation = await this.activeConversation(userId);
    const conversationId = asString(conversation.id);
    const urgent = /\b(suicide|kill myself|end my life|hurt myself|self harm)\b/i.test(content);
    const reply = buddyReply(content, urgent);
    const now = new Date().toISOString();
    const userEncrypted = this.encryption.encrypt(content);
    const replyEncrypted = this.encryption.encrypt(reply);
    const { error } = await this.database.from("buddy_messages").insert([
      {
        conversation_id: conversationId,
        user_id: userId,
        message_role: "user",
        ...toEncryptedColumns(userEncrypted),
        urgent_language_detected: urgent,
      },
      {
        conversation_id: conversationId,
        user_id: userId,
        message_role: "assistant",
        ...toEncryptedColumns(replyEncrypted),
        urgent_language_detected: urgent,
      },
    ]);
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Buddy could not save this conversation.");
    await this.database
      .from("buddy_conversations")
      .update({ last_message_at: now })
      .eq("id", conversationId)
      .eq("user_id", userId);
    if (urgent) {
      await this.database.from("audit_events").insert({
        user_id: userId,
        event_type: "buddy.urgent_language_detected",
        resource_type: "buddy_conversation",
        resource_id: conversationId,
        request_id: randomUUID(),
        metadata: { support_resources_shown: true },
      });
    }
    return this.buddySession(userId);
  }

  async emotionInsights(userId: string) {
    const entries = await this.journals.list(userId);
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

  async completeGrounding(
    userId: string,
    input: { technique: string; durationSeconds: number; pace: string },
  ) {
    const { data, error } = await this.database
      .from("audit_events")
      .insert({
        user_id: userId,
        event_type: "grounding.session_completed",
        resource_type: "grounding_session",
        resource_id: null,
        request_id: randomUUID(),
        metadata: {
          technique: input.technique,
          duration_seconds: input.durationSeconds,
          pace: input.pace,
        },
      })
      .select("id, created_at")
      .single();
    if (error || !data) {
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The grounding session could not be recorded.");
    }
    const { count, error: countError } = await this.database
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("event_type", "grounding.session_completed");
    if (countError) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Grounding history could not be loaded.");
    return { id: data.id, completedAt: data.created_at, completedSessions: count ?? 1 };
  }

  async supportResources(query?: string, type?: string) {
    let builder = this.database
      .from("support_resources")
      .select("*")
      .eq("is_active", true)
      .eq("is_verified", true)
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
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Support resources are temporarily unavailable.");
    return ((data ?? []) as DatabaseRow[]).map((row) => ({
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
    }));
  }

  async buddyHistory(userId: string) {
    const { data, error } = await this.database
      .from("buddy_conversations")
      .select("id, conversation_status, last_message_at, created_at")
      .eq("user_id", userId)
      .order("last_message_at", { ascending: false });
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Buddy history could not be loaded.");
    return data ?? [];
  }

  async ensureOwnedConversation(userId: string, conversationId: string) {
    const { data, error } = await this.database
      .from("buddy_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Buddy is temporarily unavailable.");
    if (!data) throw new NotFoundError("The Buddy conversation was not found.");
  }
}
