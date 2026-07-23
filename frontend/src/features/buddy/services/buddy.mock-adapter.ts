import type { BuddyService, BuddyServiceResult } from "./buddy.service";
import type { BuddyConversation, BuddyMessage, BuddySession, CreateConversationInput, SendMessageInput, BuddyPagination } from "../model/buddy.model";
import type { BuddyServiceError } from "../model/buddy.model";

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
  return ${prefix}--;
}

function toServiceError(code: BuddyServiceError["code"], message: string): BuddyServiceResult<never> {
  return { success: false, error: { code, message } };
}

export function createBuddyMockAdapter(): BuddyService {
  const conversations = [...seedConversations];
  const messages: Record<string, BuddyMessage[]> = {};
  Object.entries(seedMessages).forEach(([key, value]) => { messages[key] = [...value]; });
  let nextConvId = 4;

  const service: BuddyService = {
    async listConversations(page, pageSize, signal) {
      await delay(150 + Math.random() * 150);
      if (signal?.aborted) return toServiceError("NETWORK", "Request was cancelled");
      const totalItems = conversations.length;
      const totalPages = Math.ceil(totalItems / pageSize);
      const start = (page - 1) * pageSize;
      const paged = conversations.slice(start, start + pageSize);
      return { success: true, data: { conversations: paged, pagination: { page, pageSize, totalItems, totalPages } } };
    },

    async searchConversations(query, signal) {
      await delay(100);
      if (signal?.aborted) return toServiceError("NETWORK", "Request was cancelled");
      const q = query.toLowerCase();
      const filtered = conversations.filter((c) => c.title.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q));
      return { success: true, data: filtered };
    },

    async getConversation(id, signal) {
      await delay(100 + Math.random() * 100);
      if (signal?.aborted) return toServiceError("NETWORK", "Request was cancelled");
      const conversation = conversations.find((c) => c.id === id);
      if (!conversation) return toServiceError("NOT_FOUND", "Conversation not found");
      return { success: true, data: { conversation, messages: messages[id] ?? [] } };
    },

    async createConversation(input) {
      await delay(200 + Math.random() * 200);
      const conversation: BuddyConversation = {
        id: conv-,
        title: input.title,
        lastMessage: "",
        lastMessageAt: "Just now",
        messageCount: 0,
        mood: input.initialMood ?? "neutral",
        createdAt: new Date().toISOString(),
      };
      conversations.unshift(conversation);
      messages[conversation.id] = [];
      return { success: true, data: conversation };
    },

    async renameConversation(id, title) {
      await delay(150);
      const conv = conversations.find((c) => c.id === id);
      if (!conv) return toServiceError("NOT_FOUND", "Conversation not found");
      conv.title = title;
      return { success: true, data: conv };
    },

    async deleteConversation(id) {
      await delay(150);
      const idx = conversations.findIndex((c) => c.id === id);
      if (idx === -1) return toServiceError("NOT_FOUND", "Conversation not found");
      conversations.splice(idx, 1);
      delete messages[id];
      return { success: true, data: undefined as unknown as void };
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

    async retryMessage(conversationId, messageId) {
      await delay(300 + Math.random() * 300);
      const convMsgs = messages[conversationId];
      if (!convMsgs) return toServiceError("NOT_FOUND", "Message not found");
      const msg = convMsgs.find((m) => m.id === messageId);
      if (!msg) return toServiceError("NOT_FOUND", "Message not found");
      const buddyMsg: BuddyMessage = {
        id: generateId("msg"),
        conversationId,
        role: "buddy",
        content: "Let me try again. I hear you, and I want to make sure I understand what you are going through. Can you tell me a bit more about how you are feeling?",
        timestamp: "Just now",
      };
      convMsgs.push(buddyMsg);
      return { success: true, data: buddyMsg };
    },

    async sendFeedback(messageId, feedback) {
      await delay(100);
      for (const convMsgs of Object.values(messages)) {
        const msg = convMsgs?.find((m) => m.id === messageId);
        if (msg) { msg.feedback = feedback; break; }
      }
      return { success: true, data: undefined as unknown as void };
    },
  };

  return service;
}
