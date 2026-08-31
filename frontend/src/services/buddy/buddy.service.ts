import type {
  BuddyConversation,
  BuddyMessage,
  BuddySession,
  SendMessageInput,
  BuddyPagination,
  BuddyServiceError,
} from "@/features/buddy/model/buddy.model";

export type BuddyServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: BuddyServiceError };

export interface BuddyService {
  getAccessStatus(signal?: AbortSignal): Promise<BuddyServiceResult<{ canAccessAi: boolean }>>;
  listConversations(page: number, pageSize: number, signal?: AbortSignal): Promise<BuddyServiceResult<{ conversations: BuddyConversation[]; pagination: BuddyPagination }>>;
  getConversation(id: string, signal?: AbortSignal): Promise<BuddyServiceResult<BuddySession>>;
  sendMessage(input: SendMessageInput): Promise<BuddyServiceResult<BuddyMessage>>;
}
