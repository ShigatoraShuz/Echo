import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(["asc", "desc"]).default("desc"),
});

export const journalFilterSchema = z.object({
  search: z.string().optional(),
  mood: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const createJournalSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
  mood: z.string().optional(),
  emotions: z.array(z.string()).optional(),
  energy: z.number().min(1).max(10).optional(),
  is_private: z.boolean().optional(),
});

export const updateJournalSchema = createJournalSchema.partial();

export const buddyMessageSchema = z.object({
  role: z.enum(["user", "buddy"]),
  content: z.string().min(1).max(5000),
});

export const createConversationSchema = z.object({
  title: z.string().min(1).max(200),
  mood: z.string().optional(),
});

export const groundingSessionSchema = z.object({
  type: z.enum(["sensory", "box_breathing", "five_senses", "grounding_scan"]),
  duration: z.number().int().positive().max(3600),
  pace: z.string().optional(),
});

export const consentSchema = z.object({
  terms: z.boolean(),
  privacy: z.boolean(),
  dataProcessing: z.boolean(),
  aiInformation: z.boolean(),
  journalAnalysis: z.boolean(),
});

export const onboardingProfileSchema = z.object({
  display_name: z.string().min(1).max(100),
  goals: z.array(z.string()).optional(),
  buddy_tone: z.enum(["gentle", "direct", "encouraging", "neutral"]).optional(),
});

export const profileUpdateSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  timezone: z.string().optional(),
});

export const trustedContactSchema = z.object({
  contact_name: z.string().min(1).max(200),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().optional(),
  relationship: z.string().optional(),
});

export const cameraSettingsSchema = z.object({
  camera_enabled: z.boolean(),
  camera_interval_minutes: z.number().int().min(5).max(240),
  facial_analysis_consent: z.boolean(),
});

export const moodEntrySchema = z.object({
  mood: z.string().min(1),
  energy: z.number().min(1).max(10),
  notes: z.string().max(500).optional(),
});
