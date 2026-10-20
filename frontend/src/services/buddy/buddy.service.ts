import type {
  BuddyConversation,
  BuddyMessage,
  BuddySession,
  CreateConversationInput,
  SendMessageInput,
  BuddyPagination,
  BuddyServiceError,
  BuddySendResult,
} from "@/features/buddy/model/buddy.model";

export type BuddyServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: BuddyServiceError };

export interface BuddyService {
  getAccessStatus(signal?: AbortSignal): Promise<BuddyServiceResult<{ canAccessAi: boolean; accessRequirement?: "verification" | "trusted_contact" | null; buddyHistoryEnabled?: boolean }>>;
  listConversations(page: number, pageSize: number, signal?: AbortSignal, query?: string): Promise<BuddyServiceResult<{ conversations: BuddyConversation[]; pagination: BuddyPagination }>>;
  getConversation(id: string, signal?: AbortSignal): Promise<BuddyServiceResult<BuddySession>>;
  pinConversation(id: string, pinned: boolean): Promise<BuddyServiceResult<string | null>>;
  createConversation(input?: CreateConversationInput): Promise<BuddyServiceResult<BuddyConversation>>;
  renameConversation(id: string, title: string): Promise<BuddyServiceResult<BuddyConversation>>;
  deleteConversation(id: string): Promise<BuddyServiceResult<void>>;
  sendMessage(input: SendMessageInput): Promise<BuddyServiceResult<BuddySendResult>>;
  retryMessage(conversationId: string, messageId: string): Promise<BuddyServiceResult<BuddyMessage>>;
  sendFeedback(messageId: string, feedback: "positive" | "negative"): Promise<BuddyServiceResult<void>>;
}
