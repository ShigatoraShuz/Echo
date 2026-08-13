import { z } from "zod";

export const notificationPreferenceSchema = z.object({
  email_enabled: z.boolean(),
  push_enabled: z.boolean(),
  journal_reminders_enabled: z.boolean(),
  insight_notifications_enabled: z.boolean(),
});

export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;
