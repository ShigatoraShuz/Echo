import { z } from "zod";
export const TALK_PROTOCOL = "echo-buddy-talk-v2" as const;
export const talkSpeechModeSchema = z.enum(["sentences_2_then_3", "buffered"]);
export const talkLanguageSchema = z.enum(["English", "Filipino", "Taglish"]);
export const TALK_AUDIO = { sampleRate: 48000, channels: 2, maxValuesPerFrame: 4000 } as const;
export const talkSessionInputSchema = z
  .object({
    conversationId: z.string().uuid().optional(),
    temporarySessionId: z.string().uuid(),
    speechMode: talkSpeechModeSchema.default("sentences_2_then_3"),
    language: talkLanguageSchema.default("English"),
    experimentalLanguages: z.boolean().default(false),
  })
  .strict()
  .refine((x) => x.language === "English" || x.experimentalLanguages, {
    message: "Filipino and Taglish require experimental language opt-in.",
  });
const turn = { turnId: z.string().uuid(), generation: z.number().int().positive().max(100000) };
export const talkClientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("authenticate"), ticket: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ type: z.literal("begin"), ...turn }).strict(),
  z.object({ type: z.literal("finish"), ...turn }).strict(),
  z.object({ type: z.literal("cancel"), generation: turn.generation }).strict(),
  z.object({ type: z.literal("retry_speech"), ...turn }).strict(),
  z
    .object({
      type: z.literal("played"),
      ...turn,
      sequence: z.number().int().min(0),
      samples: z.number().int().min(0).max(TALK_AUDIO.maxValuesPerFrame),
    })
    .strict(),
  z
    .object({ type: z.literal("playback_started"), ...turn, elapsedMs: z.number().finite().min(0).max(3600000) })
    .strict(),
  z.object({ type: z.literal("ping") }).strict(),
  z.object({ type: z.literal("stop") }).strict(),
]);
export const talkAudioEventSchema = z.object({
  type: z.literal("audio"),
  sequence: z.number().int().nonnegative(),
  sampleRate: z.literal(48000),
  channels: z.literal(2),
  audio: z.string().min(4).max(10668),
});
export const talkDeliverySchema = z
  .object({
    state: z.enum(["interrupted", "played"]),
    playedMs: z.number().finite().min(0).max(300000),
  })
  .strict();
export type TalkDelivery = z.infer<typeof talkDeliverySchema>;
export type TalkSpeechMode = z.infer<typeof talkSpeechModeSchema>;
export type TalkLanguage = z.infer<typeof talkLanguageSchema>;

export const talkPlaybackStateSchema = z.enum([
  "idle",
  "preparing",
  "listening",
  "transcribing",
  "thinking",
  "preparing_speech",
  "speaking",
  "buffering",
  "playback_blocked",
  "recovering",
  "speech_failed",
  "paused",
  "unavailable",
  "auth_required",
]);
export const talkSegmentReadySchema = z.object({
  type: z.literal("segment_ready"),
  index: z.number().int().nonnegative(),
  sampleRate: z.literal(48000),
  channels: z.literal(2),
  readyMs: z.number().finite().nonnegative(),
  model: z.record(z.string(), z.unknown()),
});
export const talkModelReadinessSchema = z.object({
  whisperDevice: z.literal("cpu").optional(),
  freeGpuBytes: z.number().finite().nonnegative().optional(),
  loadAndWarmSeconds: z.number().finite().nonnegative().optional(),
  workers: z
    .object({
      cbt: z.number().int().positive(),
      nano: z.number().int().positive(),
      whisper: z.number().int().positive(),
    })
    .optional(),
});
export type TalkPlaybackState = z.infer<typeof talkPlaybackStateSchema>;
