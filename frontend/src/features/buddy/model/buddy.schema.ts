import { z } from "zod";

export const createConversationSchema = z.object({
  title: z.string().min(1, "Conversation title is required").max(100, "Title is too long"),
  initialMood: z.enum(["calm", "happy", "neutral", "sad", "anxious", "angry"]).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(2000, "Message is too long"),
});

export type CreateConversationFormData = z.infer<typeof createConversationSchema>;
export type SendMessageFormData = z.infer<typeof sendMessageSchema>;
