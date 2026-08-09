import type {
  BuddyConversation,
  BuddyMessage,
  BuddySession,
  CreateConversationInput,
  SendMessageInput,
  BuddyPagination,
  BuddyServiceError,
} from "../model/buddy.model";

export type BuddyServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: BuddyServiceError };

export interface BuddyService {
  getAccessStatus(signal?: AbortSignal): Promise<BuddyServiceResult<{ canAccessAi: boolean }>>;
  listConversations(page: number, pageSize: number, signal?: AbortSignal): Promise<BuddyServiceResult<{ conversations: BuddyConversation[]; pagination: BuddyPagination }>>;
  searchConversations(query: string, signal?: AbortSignal): Promise<BuddyServiceResult<BuddyConversation[]>>;
  getConversation(id: string, signal?: AbortSignal): Promise<BuddyServiceResult<BuddySession>>;
  createConversation(input: CreateConversationInput): Promise<BuddyServiceResult<BuddyConversation>>;
  renameConversation(id: string, title: string): Promise<BuddyServiceResult<BuddyConversation>>;
  deleteConversation(id: string): Promise<BuddyServiceResult<void>>;
  sendMessage(input: SendMessageInput): Promise<BuddyServiceResult<BuddyMessage>>;
  retryMessage(conversationId: string, messageId: string): Promise<BuddyServiceResult<BuddyMessage>>;
  sendFeedback(messageId: string, feedback: "positive" | "negative"): Promise<BuddyServiceResult<void>>;
}
