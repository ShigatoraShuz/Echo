import type { BuddyService, BuddyServiceResult } from "@/services/buddy/buddy.service";
import type { BuddyConversation, BuddyMessage } from "@/features/buddy/model/buddy.model";
import type { BuddyServiceError } from "@/features/buddy/model/buddy.model";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const seedConversations: BuddyConversation[] = [
  { id: "conv-1", title: "Evening grounding", lastMessage: "That helps, thank you.", lastMessageAt: "Today", messageCount: 8, mood: "anxious", createdAt: "2026-07-22T20:00:00Z" },
  { id: "conv-2", title: "After-work reflection", lastMessage: "I think I need a break.", lastMessageAt: "Yesterday", messageCount: 12, mood: "neutral", createdAt: "2026-07-21T18:30:00Z" },
  { id: "conv-3", title: "Sleep routine planning", lastMessage: "Will try the breathing exercise.", lastMessageAt: "Monday", messageCount: 6, mood: "calm", createdAt: "2026-07-20T22:00:00Z" },
];

const seedMessages: Record<string, BuddyMessage[]> = {
  "conv-1": [
    { id: "msg-1", conversationId: "conv-1", role: "user", content: "I have had a long day and feel tense.", timestamp: "7:05 PM" },
    { id: "msg-2", conversationId: "conv-1", role: "buddy", content: "It sounds like today carried a lot. Let's take a gentle moment together. What does the tension feel like in your body right now?", timestamp: "7:05 PM" },
    { id: "msg-3", conversationId: "conv-1", role: "user", content: "My shoulders are tight and I keep sighing.", timestamp: "7:06 PM" },
    { id: "msg-4", conversationId: "conv-1", role: "buddy", content: "That is your body letting you know it needs release. Let's try a simple grounding exercise together. Breathe in slowly for four counts, hold for four, and release for six.", timestamp: "7:06 PM" },
  ],
};

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

function toServiceError(code: BuddyServiceError["code"], message: string): BuddyServiceResult<never> {
  return { success: false, error: { code, message } };
}

export function createBuddyMockAdapter(): BuddyService {
  const conversations = [...seedConversations];
  const messages: Record<string, BuddyMessage[]> = {};
  Object.entries(seedMessages).forEach(([key, value]) => { messages[key] = [...value]; });
const service: BuddyService = {
    async getAccessStatus(signal) {
      await delay(80 + Math.random() * 80);
      if (signal?.aborted) return toServiceError("NETWORK", "Request was cancelled");
      return { success: true, data: { canAccessAi: true } };
    },

    async listConversations(page, pageSize, signal) {
      await delay(150 + Math.random() * 150);
      if (signal?.aborted) return toServiceError("NETWORK", "Request was cancelled");
      const totalItems = conversations.length;
      const totalPages = Math.ceil(totalItems / pageSize);
      const start = (page - 1) * pageSize;
      const paged = conversations.slice(start, start + pageSize);
      return { success: true, data: { conversations: paged, pagination: { page, pageSize, totalItems, totalPages } } };
    },

    async getConversation(id, signal) {
      await delay(100 + Math.random() * 100);
      if (signal?.aborted) return toServiceError("NETWORK", "Request was cancelled");
      const conversation = conversations.find((c) => c.id === id);
      if (!conversation) return toServiceError("NOT_FOUND", "Conversation not found");
      return { success: true, data: { conversation, messages: messages[id] ?? [] } };
    },

    async sendMessage(input) {
      await delay(300 + Math.random() * 500);
      const conv = conversations.find((c) => c.id === input.conversationId);
      if (!conv) return toServiceError("NOT_FOUND", "Conversation not found");
      const userMsg: BuddyMessage = {
        id: generateId("msg"),
        conversationId: input.conversationId,
        role: "user",
        content: input.content,
        timestamp: "Just now",
      };
      if (!messages[input.conversationId]) messages[input.conversationId] = [];
      messages[input.conversationId].push(userMsg);
      const buddyMsg: BuddyMessage = {
        id: generateId("msg"),
        conversationId: input.conversationId,
        role: "buddy",
        content: "Thank you for sharing that with me. It takes courage to name what is present. Let's sit with that for a moment and explore what might help next.",
        timestamp: "Just now",
      };
      messages[input.conversationId].push(buddyMsg);
      conv.lastMessage = input.content.slice(0, 60);
      conv.lastMessageAt = "Just now";
      conv.messageCount = messages[input.conversationId].length;
      return { success: true, data: buddyMsg };
    },

  };

  return service;
}
