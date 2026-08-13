import { z } from "zod";

export const updateProfileSchema = z.object({
  display_name: z.string().trim().min(1).max(100).optional(),
  avatar_path: z.string().trim().max(500).nullable().optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  onboarding_completed: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one profile field must be supplied.");

export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
