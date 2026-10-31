import type { BuddyService } from "@/services/buddy/buddy.service";
import type {
  BuddyConversation,
  BuddyMessage,
  BuddyServiceError,
} from "@/features/buddy/model/buddy.model";
import { env } from "@/config/environment";
import { normalizeError } from "@/shared/errors/normalize-error";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import type { VerificationSnapshot } from "@/services/verification/verification-api";

interface ApiEnvelope<T> {
  success: true;
  data: T;
}

interface BuddySessionResponse {
  conversationId: string | null;
  persisted?: boolean;
  conversation?: BuddyHistoryRow;
  messages: Array<{
    id: string;
    role: "user" | "buddy";
    content: string;
    timestamp: string;
    delivery?:{state:string};
  }>;
}

interface BuddyHistoryRow {
  id: string;
  title?: string;
  archived?: boolean;
  last_message_at: string | null;
  created_at: string;
  pinned_at?: string | null;
  preview?: string;
}

interface BuddyHistoryPage {
  conversations: BuddyHistoryRow[];
  total: number;
  page: number;
  page_size: number;
  pinsAvailable?: boolean;
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
    title: row.title || "Buddy conversation",
    lastMessage: row.preview ?? "",
    lastMessageAt: row.last_message_at
      ? new Date(row.last_message_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "",
    lastMessageAtIso: row.last_message_at ?? "",
    messageCount: 0,
    mood: "neutral",
    createdAt: row.created_at,
    pinnedAt: row.pinned_at ?? null,
  };
}

function mapMessages(conversationId: string, messages: BuddySessionResponse["messages"]): BuddyMessage[] {
  return messages.map((message) => ({
    id: message.id,
    conversationId,
    role: message.role === "user" ? "user" : "buddy",
    content: message.content,
    timestamp: message.timestamp,
    playbackInterrupted:message.delivery?.state==='interrupted',
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
        const response = await client.get<ApiEnvelope<VerificationSnapshot>>("/verification", { signal });
        const privacy = response.data.canAccessAi
          ? await client.get<ApiEnvelope<{ buddyHistoryEnabled: boolean }>>("/buddy/privacy", { signal })
          : null;
        return { success: true, data: { canAccessAi: response.data.canAccessAi, accessRequirement: response.data.accessRequirement,
          buddyHistoryEnabled: privacy?.data.buddyHistoryEnabled ?? true } };
      } catch (error) {
        return { success: false, error: toBuddyError(error) };
      }
    },

    async listConversations(page, pageSize, signal, query = "") {
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (query.trim()) params.set("query", query.trim());
        const response = await client.get<ApiEnvelope<BuddyHistoryPage>>(`/buddy/history?${params}`, { signal });
        const conversations = response.data.conversations.map(mapConversation);
        const totalItems = response.data.total;
        return {
          success: true,
          data: {
            conversations,
            pagination: {
              page,
              pageSize,
              totalItems,
              totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
              pinsAvailable: response.data.pinsAvailable ?? true,
            },
          },
        };
      } catch (error) {
        return { success: false, error: toBuddyError(error) };
      }
    },

    async getConversation(id, signal) {
      try {
        const response = await client.get<ApiEnvelope<BuddySessionResponse>>(`/buddy/conversations/${encodeURIComponent(id)}`, { signal });
        const { conversationId, messages } = response.data;
        if (!conversationId) return { success: false, error: { code: "NOT_FOUND", message: "Conversation not found." } };
        return {
          success: true,
          data: {
            conversation: mapConversation(response.data.conversation ?? { id: conversationId, last_message_at: null, created_at: "" }),
            messages: mapMessages(conversationId, messages),
          },
        };
      } catch (error) {
        return { success: false, error: toBuddyError(error) };
      }
    },

    async pinConversation(id, pinned) {
      try {
        const response = await client.put<ApiEnvelope<{ pinned_at: string | null }>, { pinned: boolean }>(`/buddy/conversations/${encodeURIComponent(id)}/pin`, { pinned });
        return { success: true, data: response.data.pinned_at };
      } catch (error) { return { success: false, error: toBuddyError(error) }; }
    },

    async createConversation() {
      try {
        const response = await client.post<ApiEnvelope<BuddyHistoryRow>>("/buddy/conversations", {});
        return { success: true, data: mapConversation(response.data) };
      } catch (error) { return { success: false, error: toBuddyError(error) }; }
    },

    async renameConversation(id, title) {
      try {
        const response = await client.patch<ApiEnvelope<BuddyHistoryRow>, { title: string }>(`/buddy/conversations/${encodeURIComponent(id)}`, { title });
        return { success: true, data: mapConversation(response.data) };
      } catch (error) { return { success: false, error: toBuddyError(error) }; }
    },

    async deleteConversation(id) {
      try {
        await client.delete(`/buddy/conversations/${encodeURIComponent(id)}`);
        return { success: true, data: undefined };
      } catch (error) { return { success: false, error: toBuddyError(error) }; }
    },

    async sendMessage(input) {
      try {
        const response = await client.post<ApiEnvelope<BuddySessionResponse>, { content: string; conversationId?: string;temporarySessionId?:string }>(
          "/buddy/messages",
          { content: input.content, conversationId: input.conversationId,temporarySessionId:input.temporarySessionId },
          { timeout: 315_000 },
        );
        const messages = mapMessages(response.data.conversationId ?? "temporary", response.data.messages).slice(-2);
        return messages.length === 2
          ? { success: true, data: { conversationId: response.data.conversationId, persisted: response.data.persisted !== false, messages } }
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
