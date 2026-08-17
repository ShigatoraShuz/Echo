import type { BuddyService, BuddyServiceResult } from "./buddy.service";
import type {
  BuddyConversation,
  BuddyMessage,
  BuddySession,
  BuddyServiceError,
} from "../model/buddy.model";
import { env } from "@/config/environment";
import { normalizeError } from "@/shared/errors/normalize-error";
import { createApiClient } from "@/shared/services/api-client";
import { supabaseAuthTokenProvider } from "@/shared/services/supabase-auth-token-provider";

interface ApiEnvelope<T> {
  success: true;
  data: T;
}

interface BuddySessionResponse {
  conversationId: string;
  messages: Array<{
    id: string;
    role: "user" | "buddy";
    content: string;
    timestamp: string;
  }>;
}

interface BuddyHistoryRow {
  id: string;
  conversation_status: string;
  last_message_at: string;
  created_at: string;
}

const NOT_SUPPORTED_MESSAGE =
  "Conversation management is not available in this build of the backend.";

function toBuddyError(error: unknown): BuddyServiceError {
  const normalized = normalizeError(error);
  switch (normalized.code) {
    case "NOT_FOUND":
      return { code: "NOT_FOUND", message: normalized.userMessage };
    case "VALIDATION_ERROR":
      return { code: "VALIDATION", message: normalized.userMessage };
    case "AUTHENTICATION_ERROR":
      return { code: "UNAUTHORIZED", message: normalized.userMessage };
    case "VERIFICATION_REQUIRED":
      return { code: "VERIFICATION_REQUIRED", message: normalized.userMessage };
    case "NETWORK_ERROR":
    case "TIMEOUT":
    case "RATE_LIMITED":
      return { code: "NETWORK", message: normalized.userMessage };
    default:
      return { code: "UNKNOWN", message: normalized.userMessage };
  }
}

function mapConversation(row: BuddyHistoryRow): BuddyConversation {
  return {
    id: row.id,
    // The backend does not persist conversation titles or per-conversation
    // message summaries yet; the UI falls back to these neutral values.
    title: "Buddy conversation",
    lastMessage: "",
    lastMessageAt: row.last_message_at
      ? new Date(row.last_message_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "",
    messageCount: 0,
    mood: "neutral",
    createdAt: row.created_at,
  };
}

function mapMessages(conversationId: string, messages: BuddySessionResponse["messages"]): BuddyMessage[] {
  return messages.map((message) => ({
    id: message.id,
    conversationId,
    role: message.role === "user" ? "user" : "buddy",
    content: message.content,
    timestamp: message.timestamp,
  }));
}

export function createBuddyHttpAdapter(): BuddyService {
  const client = createApiClient({
    baseUrl: env.apiBaseUrl,
    tokenProvider: supabaseAuthTokenProvider,
  });

  return {
    async getAccessStatus(signal) {
      try {
        await client.get<ApiEnvelope<BuddySessionResponse>>("/buddy/session", { signal });
        return { success: true, data: { canAccessAi: true } };
      } catch (error) {
        const code = normalizeError(error).code;
        if (code === "AUTHENTICATION_ERROR" || code === "AUTHORIZATION_ERROR" || code === "VERIFICATION_REQUIRED") {
          return { success: true, data: { canAccessAi: false } };
        }
        return { success: false, error: toBuddyError(error) };
      }
    },

    async listConversations(page, pageSize, signal) {
      try {
        const response = await client.get<ApiEnvelope<BuddyHistoryRow[]>>("/buddy/history", { signal });
        const all = response.data.map(mapConversation);
        const start = (page - 1) * pageSize;
        const conversations = all.slice(start, start + pageSize);
        return {
          success: true,
          data: {
            conversations,
            pagination: {
              page,
              pageSize,
              totalItems: all.length,
              totalPages: Math.max(1, Math.ceil(all.length / pageSize)),
            },
          },
        };
      } catch (error) {
        return { success: false, error: toBuddyError(error) };
      }
    },

    async searchConversations(query, signal) {
      try {
        const response = await client.get<ApiEnvelope<BuddyHistoryRow[]>>("/buddy/history", { signal });
        const q = query.toLowerCase();
        const filtered = response.data
          .map(mapConversation)
          .filter((conversation) => conversation.id.toLowerCase().includes(q));
        return { success: true, data: filtered };
      } catch (error) {
        return { success: false, error: toBuddyError(error) };
      }
    },

    async getConversation(id, signal) {
      try {
        const response = await client.get<ApiEnvelope<BuddySessionResponse>>("/buddy/session", { signal });
        const { conversationId, messages } = response.data;
        return {
          success: true,
          data: {
            conversation: { ...mapConversation({ id: conversationId, conversation_status: "active", last_message_at: "", created_at: "" }), id },
            messages: mapMessages(conversationId, messages),
          },
        };
      } catch (error) {
        return { success: false, error: toBuddyError(error) };
      }
    },

    async createConversation() {
      return { success: false, error: { code: "UNKNOWN", message: NOT_SUPPORTED_MESSAGE } };
    },

    async renameConversation() {
      return { success: false, error: { code: "UNKNOWN", message: NOT_SUPPORTED_MESSAGE } };
    },

    async deleteConversation() {
      return { success: false, error: { code: "UNKNOWN", message: NOT_SUPPORTED_MESSAGE } };
    },

    async sendMessage(input) {
      try {
        const response = await client.post<ApiEnvelope<BuddySessionResponse>, { content: string }>(
          "/buddy/messages",
          { content: input.content },
        );
        const messages = mapMessages(response.data.conversationId, response.data.messages);
        const reply = messages[messages.length - 1];
        return reply
          ? { success: true, data: reply }
          : { success: false, error: { code: "UNKNOWN", message: "Buddy did not return a reply." } };
      } catch (error) {
        return { success: false, error: toBuddyError(error) };
      }
    },

    async retryMessage() {
      return { success: false, error: { code: "UNKNOWN", message: NOT_SUPPORTED_MESSAGE } };
    },

    async sendFeedback() {
      return { success: false, error: { code: "UNKNOWN", message: NOT_SUPPORTED_MESSAGE } };
    },
  };
}