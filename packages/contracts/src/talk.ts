import { z } from "zod";
export const TALK_PROTOCOL = "echo-buddy-talk-v1" as const;
export const talkSessionInputSchema = z
  .object({ conversationId: z.string().uuid().optional(), temporarySessionId: z.string().uuid() })
  .strict();
const turn = { turnId: z.string().uuid(), generation: z.number().int().positive().max(100000) };
export const talkClientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("authenticate"), ticket: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ type: z.literal("begin"), ...turn }).strict(),
  z.object({ type: z.literal("finish"), ...turn }).strict(),
  z.object({ type: z.literal("cancel"), generation: turn.generation }).strict(),
  z
    .object({
      type: z.literal("played"),
      ...turn,
      sequence: z.number().int().min(0),
      samples: z.number().int().min(0).max(4000),
    })
    .strict(),
  z.object({ type: z.literal("ping") }).strict(),
  z.object({ type: z.literal("stop") }).strict(),
]);
export const talkDeliverySchema = z
  .object({ state: z.enum(["interrupted", "played"]), playedMs: z.number().finite().min(0).max(300000) })
  .strict();
export type TalkDelivery = z.infer<typeof talkDeliverySchema>;
