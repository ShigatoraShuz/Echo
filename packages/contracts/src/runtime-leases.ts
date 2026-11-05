import {z} from 'zod';
export const modelPreparationSchema=z.object({
 component:z.enum(['safety','cbt','nano','whisper']),
 state:z.enum(['checking','loading','warming','retrying','ready','failed','cancelled']),
 loadingComponents:z.array(z.enum(['safety','cbt','nano','whisper'])).max(4).optional(),
 attempt:z.number().int().min(1).max(5),maxAttempts:z.literal(5),
 elapsedSeconds:z.number().finite().min(0).max(6600).optional(),
 retryInSeconds:z.number().finite().min(0).max(20).optional(),
 code:z.string().regex(/^BUDDY_[A-Z_]{1,70}$/).optional(),retryable:z.boolean().optional(),
 correlationId:z.string().regex(/^[a-f0-9]{32}$/).optional(),
}).strict();
export type ModelPreparation=z.infer<typeof modelPreparationSchema>;
export const modelPageLeaseSchema=z.object({
 id:z.string().uuid(),profile:z.enum(['buddy_chat','journal']),expiresAt:z.string().datetime(),faceEligible:z.boolean().optional(),
 preparation:modelPreparationSchema.optional(),
 releasePending:z.boolean().optional(),releaseAt:z.string().datetime().optional(),
 state:z.enum(['unloaded','preparing','ready','releasing','waiting_for_capacity','failed']),code:z.string().regex(/^[A-Z_]{1,80}$/).optional(),
}).strict();
export type ModelPageLease=z.infer<typeof modelPageLeaseSchema>;
