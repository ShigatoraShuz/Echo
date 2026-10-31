import { z } from "zod";

export const notificationPreferenceSchema = z.object({
  email_enabled: z.boolean(),
  push_enabled: z.boolean(),
  journal_reminders_enabled: z.boolean(),
  insight_notifications_enabled: z.boolean(),
});

export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;

export const notificationItemSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  resourceType: z.string().nullable(),
  resourceId: z.string().uuid().nullable(),
  resourceLabel: z.string().nullable().optional(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type NotificationItem = z.infer<typeof notificationItemSchema>;

// Exact inbox types emitted by ProfessionalService and owner appointment delivery.
// Proposal also represents rescheduling; update represents responses/cancellation.
export const appointmentNotificationTypes = [
  "professional_appointment_proposed",
  "professional_appointment_update",
  "professional_appointment_completed",
] as const;
export type NotificationCategory = "all" | "general" | "appointments";
export const notificationCursorSchema = z.string().max(100).refine(value => {
  const [at, id, extra] = value.split("~");
  return extra === undefined && z.iso.datetime({ offset: true }).safeParse(at).success && z.uuid().safeParse(id).success;
}, "Invalid notification cursor");
