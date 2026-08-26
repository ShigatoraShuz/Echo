import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EncryptionService, EncryptedPayload } from "../../infrastructure/encryption/encryption.service.js";
import { ExternalServiceError, NotFoundError } from "../../shared/errors/app-error.js";
import { asString } from "../../shared/utils/coerce.js";

type DatabaseRow = Record<string, unknown>;

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

export class BuddyService {
  constructor(
    private readonly database: SupabaseClient,
    private readonly encryption: EncryptionService,
  ) {}

  private decryptMessage(row: DatabaseRow): string {
    return this.encryption.decrypt({
      ciphertext: base64FromBytea(row.content_ciphertext),
      iv: base64FromBytea(row.encryption_iv),
      authenticationTag: base64FromBytea(row.encryption_auth_tag),
      keyVersion: Number(row.encryption_key_version),
    });
  }

  private encryptBuddyText(text: string): ReturnType<EncryptionService["encrypt"]> {
    return this.encryption.encrypt(text);
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

    const encryptedTitle = this.encryptBuddyText("Buddy conversation");
    const { data: created, error: createError } = await this.database
      .from("buddy_conversations")
      .insert({
        user_id: userId,
        title_ciphertext: bytea(encryptedTitle.ciphertext),
        encryption_iv: bytea(encryptedTitle.iv),
        encryption_auth_tag: bytea(encryptedTitle.authenticationTag),
        encryption_key_version: encryptedTitle.keyVersion,
        conversation_status: "active",
      })
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
      role: row.role === "user" ? "user" : "buddy",
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

  async buddyHistory(userId: string) {
    const { data, error } = await this.database
      .from("buddy_conversations")
      .select("id, archived, last_message_at, created_at")
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
