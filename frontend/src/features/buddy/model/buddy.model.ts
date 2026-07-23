export type BuddyMood = "calm" | "happy" | "neutral" | "sad" | "anxious" | "angry";

export interface BuddyConversation {
  id: string;
  title: string;
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
  mood: BuddyMood;
  createdAt: string;
}

export interface BuddyMessage {
  id: string;
  conversationId: string;
  role: "user" | "buddy";
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  isError?: boolean;
  retryCount?: number;
  feedback?: "positive" | "negative" | null;
}

export interface BuddySession {
  conversation: BuddyConversation;
  messages: BuddyMessage[];
}

export interface CreateConversationInput {
  title: string;
  initialMood?: BuddyMood;
}

export interface SendMessageInput {
  conversationId: string;
  content: string;
}

export type BuddyServiceErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "VERIFICATION_REQUIRED"
  | "NETWORK"
  | "UNKNOWN";

export interface BuddyServiceError {
  code: BuddyServiceErrorCode;
  message: string;
  details?: Record<string, string[]>;
}

export interface BuddyPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
