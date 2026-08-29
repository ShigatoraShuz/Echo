import { z } from "zod";

export const apiErrorCodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]*$/);
export const apiFieldErrorSchema = z.object({
  field: z.string().min(1),
  message: z.string().min(1),
});

export const apiErrorPayloadSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1),
  details: z.object({
    fields: z.array(apiFieldErrorSchema).optional(),
  }).catchall(z.unknown()).optional(),
});

export const apiErrorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: apiErrorPayloadSchema,
  meta: z.object({ requestId: z.string().uuid() }),
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorPayload = z.infer<typeof apiErrorPayloadSchema>;
export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;
