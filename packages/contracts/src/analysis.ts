import { z } from "zod";

export const analysisStatuses = [
  "queued",
  "waiting_for_provider",
  "safety_checking",
  "safety_action_required",
  "analyzing_emotions",
  "classifying_distress",
  "estimating_screening",
  "generating_recommendation",
  "aggregating_week",
  "completed",
  "retrying",
  "failed",
] as const;

export const analysisStatusSchema = z.enum(analysisStatuses);
export const analysisModeSchema = z.enum(["disabled", "development_stub", "local_worker"]);
export const analysisFixtureSchema = z.enum([
  "standard_low_distress",
  "standard_moderate_distress",
  "slow_processing",
  "processing_failure",
  "invalid_output",
  "safety_support_required",
]);
export const distressBandSchema = z.enum(["low", "mild", "moderate", "high", "severe"]);
export const emotionNameSchema = z.enum(["joy", "calm", "sadness", "anxiety", "anger", "hope"]);

export const analysisProgressSchema = z.object({
  jobId: z.string().uuid(),
  journalId: z.string().uuid(),
  status: analysisStatusSchema,
  progress: z.number().int().min(0).max(100),
  updatedAt: z.string().datetime(),
});

export const journalAnalysisResultSchema = z
  .object({
    schemaVersion: z.literal("echo-journal-analysis-v1"),
    thresholdVersion: z.string().trim().min(1).max(80),
    providerName: z.string().trim().min(1).max(80),
    modelVersion: z.string().trim().min(1).max(120),
    isSimulated: z.boolean(),
    emotionDistribution: z
      .array(z.object({ emotion: emotionNameSchema, value: z.number().min(0).max(1) }).strict())
      .length(6),
    dominantEmotion: emotionNameSchema,
    emotionConfidence: z.number().min(0).max(1),
    distressBand: distressBandSchema,
    distressConfidence: z.number().min(0).max(1),
    depressiveSymptomRange: z
      .object({ lower: z.number().int().min(0).max(24), upper: z.number().int().min(0).max(24) })
      .strict()
      .refine((range) => range.lower <= range.upper, "The screening range is invalid."),
    recommendationFeatures: z
      .array(
        z.enum(["paced_breathing", "grounding", "behavioral_activation", "thought_reframing", "support_connection"]),
      )
      .min(1)
      .max(5),
  })
  .strict()
  .superRefine((result, context) => {
    const total = result.emotionDistribution.reduce((sum, item) => sum + item.value, 0);
    if (Math.abs(total - 1) > 0.001)
      context.addIssue({ code: "custom", path: ["emotionDistribution"], message: "Emotion values must total 1." });
    if (new Set(result.emotionDistribution.map((item) => item.emotion)).size !== 6)
      context.addIssue({
        code: "custom",
        path: ["emotionDistribution"],
        message: "Each emotion must occur exactly once.",
      });
    if (
      !result.emotionDistribution.some(
        (item) =>
          item.emotion === result.dominantEmotion &&
          item.value === Math.max(...result.emotionDistribution.map((entry) => entry.value)),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["dominantEmotion"],
        message: "Dominant emotion must have the highest distribution value.",
      });
    }
  });

export const journalSubmissionResponseSchema = z.object({
  journalId: z.string().uuid(),
  analysisJobId: z.string().uuid(),
  status: z.enum(["queued", "waiting_for_provider"]),
});

export const dashboardInsightsSchema = z.object({
  latestResultId: z.string().uuid().nullable().optional(),
  latest: journalAnalysisResultSchema.nullable(),
  recommendation: z
    .object({ id: z.string().uuid(), title: z.string(), description: z.string(), activity: z.string() })
    .nullable(),
  emotionTrend: z.array(
    z.object({
      date: z.string().date(),
      values: z.record(z.string(), z.number().min(0).max(1)),
      isSimulated: z.boolean(),
    }),
  ),
  distressTrend: z.array(
    z.object({
      date: z.string().date(),
      band: distressBandSchema,
      value: z.number().min(0).max(1),
      isSimulated: z.boolean(),
    }),
  ),
});

export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;
export type AnalysisMode = z.infer<typeof analysisModeSchema>;
export type AnalysisFixture = z.infer<typeof analysisFixtureSchema>;
export type AnalysisProgress = z.infer<typeof analysisProgressSchema>;
export type JournalAnalysisResult = z.infer<typeof journalAnalysisResultSchema>;
export type JournalSubmissionResponse = z.infer<typeof journalSubmissionResponseSchema>;
export type DashboardInsights = z.infer<typeof dashboardInsightsSchema>;
