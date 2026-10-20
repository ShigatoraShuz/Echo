import { z } from "zod";

export const professionalRequestStatusSchema = z.enum([
  "submitted",
  "assigned",
  "scheduled",
  "closed",
  "declined",
  "withdrawn",
]);

export const professionalOrganizationSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  serviceHours: z.string(),
  location: z.string(),
  serviceTypes: z.array(z.string()),
  consultationMethods: z.array(z.string()),
  status: z.string(),
});

export const practitionerProfileSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  displayName: z.string(),
  role: z.string(),
  credentialLabel: z.string().nullable(),
  bio: z.string(),
  specialties: z.array(z.string()),
  serviceTypes: z.array(z.string()),
  consultationMethods: z.array(z.string()),
  location: z.string(),
  responseHours: z.string(),
  acceptingRequests: z.boolean(),
});

export const supportRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  preferredProfileId: z.string().uuid().nullable(),
  status: professionalRequestStatusSchema,
  assignedTo: z.string().uuid().nullable(),
  assignedProfessional: practitionerProfileSchema.nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  preferredTime: z.string(),
  sharingActive: z.boolean(),
  sharedJournalCount: z.number().int().nonnegative(),
  sharedPhq8Count: z.number().int().nonnegative(),
  summary: z.string().nullable().optional(),
});

export const createProfessionalRequestSchema = z.strictObject({
  submissionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  preferredProfileId: z.string().uuid().nullable().default(null),
  summary: z.string().trim().min(20).max(4000),
  preferredTime: z.string().trim().max(240).default(""),
  journalIds: z.array(z.string().uuid()).max(3).default([]),
  phq8Ids: z.array(z.string().uuid()).max(3).default([]),
  consent: z.literal(true),
});

export const caseMessageSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  sender: z.enum(["user", "professional"]),
  body: z.string(),
  createdAt: z.string().datetime(),
});

export const sharedRecordSchema = z.object({
  id: z.string().uuid(),
  resourceType: z.enum(["journal", "phq8"]),
  sourceRecordId: z.string().uuid(),
  label: z.string(),
  grantedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
});

export const caseEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  label: z.string(),
  createdAt: z.string().datetime(),
});

export const professionalAppointmentSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  mode: z.string(),
  locationHint: z.string(),
  status: z.string(),
});

export type ProfessionalOrganization = z.infer<typeof professionalOrganizationSchema>;
export type PractitionerProfile = z.infer<typeof practitionerProfileSchema>;
export type SupportRequest = z.infer<typeof supportRequestSchema>;
export type CreateProfessionalRequest = z.infer<typeof createProfessionalRequestSchema>;
export type CaseMessage = z.infer<typeof caseMessageSchema>;
export type SharedRecord = z.infer<typeof sharedRecordSchema>;
export type CaseEvent = z.infer<typeof caseEventSchema>;
export type ProfessionalAppointment = z.infer<typeof professionalAppointmentSchema>;
