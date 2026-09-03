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

export const facialAnalysisStatuses = [
  "not_requested",
  "not_captured",
  "captured_pending_provider",
  "queued",
  "analyzing",
  "completed",
  "unavailable",
  "failed",
] as const;
export const facialAnalysisStatusSchema = z.enum(facialAnalysisStatuses);

export const analysisCheckIds = ["safety_crisis", "emotion", "distress", "phq8", "facial"] as const;
export const analysisCheckIdSchema = z.enum(analysisCheckIds);
export const analysisCheckStates = [
  "pending",
  "running",
  "complete",
  "skipped",
  "partial",
  "attention_required",
  "failed",
] as const;
export const analysisCheckStateSchema = z.enum(analysisCheckStates);

const faceLandmarkSchema = z.tuple([z.number(), z.number(), z.number()]);
const faceBlendshapeSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    score: z.number().min(0).max(1),
  })
  .strict();

/** Mesh-only facial capture. Image/video fields are intentionally not accepted. */
export const faceMeshCaptureSchema = z
  .object({
    schemaVersion: z.literal("echo-face-mesh-v1"),
    capturedAt: z.string().datetime(),
    modelVersion: z.string().trim().min(1).max(120),
    landmarks: z.array(faceLandmarkSchema).length(478),
    blendshapes: z.array(faceBlendshapeSchema).length(52),
  })
  .strict();

export const analysisCheckProgressSchema = z
  .object({
    id: analysisCheckIdSchema,
    state: analysisCheckStateSchema,
    detail: z.string().trim().min(1).max(160),
  })
  .strict();

export const analysisProgressSchema = z.object({
  jobId: z.string().uuid(),
  journalId: z.string().uuid(),
  status: analysisStatusSchema,
  progress: z.number().int().min(0).max(100),
  updatedAt: z.string().datetime(),
  facialStatus: facialAnalysisStatusSchema.default("not_requested"),
  checks: z.array(analysisCheckProgressSchema).length(5).optional(),
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
    facialExpressionAnalysis: z
      .object({
        detectedEmotion: z.string().trim().min(1).max(80),
        emotionDistribution: z.array(
          z.object({ emotion: z.string().trim().min(1).max(80), value: z.number().min(0).max(1) }).strict(),
        ),
        confidence: z.number().min(0).max(1),
        providerName: z.string().trim().min(1).max(80),
        modelVersion: z.string().trim().min(1).max(120),
      })
      .strict()
      .nullable()
      .default(null),
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
  facialStatus: facialAnalysisStatusSchema.default("not_requested"),
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
export type AnalysisCheckId = z.infer<typeof analysisCheckIdSchema>;
export type AnalysisCheckState = z.infer<typeof analysisCheckStateSchema>;
export type AnalysisCheckProgress = z.infer<typeof analysisCheckProgressSchema>;
export type FacialAnalysisStatus = z.infer<typeof facialAnalysisStatusSchema>;
export type FaceMeshCapture = z.infer<typeof faceMeshCaptureSchema>;
export type JournalAnalysisResult = z.infer<typeof journalAnalysisResultSchema>;
export type JournalSubmissionResponse = z.infer<typeof journalSubmissionResponseSchema>;
export type DashboardInsights = z.infer<typeof dashboardInsightsSchema>;

const textCheckDetails: Record<Exclude<AnalysisCheckId, "facial">, string> = {
  safety_crisis: "Safety check complete",
  emotion: "Emotion patterns ready",
  distress: "Distress signal ready",
  phq8: "Symptom range ready",
};

function facialCheck(status: FacialAnalysisStatus): AnalysisCheckProgress {
  switch (status) {
    case "not_requested":
      return { id: "facial", state: "skipped", detail: "Not requested" };
    case "not_captured":
      return { id: "facial", state: "skipped", detail: "No valid mesh captured" };
    case "captured_pending_provider":
      return { id: "facial", state: "partial", detail: "Captured — analysis provider not connected" };
    case "queued":
      return { id: "facial", state: "pending", detail: "Mesh queued securely" };
    case "analyzing":
      return { id: "facial", state: "running", detail: "Analyzing facial expression" };
    case "completed":
      return { id: "facial", state: "complete", detail: "Facial expression insight ready" };
    case "failed":
      return { id: "facial", state: "failed", detail: "Facial analysis could not finish" };
    case "unavailable":
      return { id: "facial", state: "partial", detail: "Facial analysis unavailable" };
  }
}

/** Builds the safe, user-facing five-check projection from the aggregate worker stage. */
export function analysisChecksFor(
  status: AnalysisStatus,
  facialStatus: FacialAnalysisStatus = "not_requested",
  progress = 0,
): AnalysisCheckProgress[] {
  const order: Array<Exclude<AnalysisCheckId, "facial">> = ["safety_crisis", "emotion", "distress", "phq8"];
  const runningIndex: Partial<Record<AnalysisStatus, number>> = {
    safety_checking: 0,
    analyzing_emotions: 1,
    classifying_distress: 2,
    estimating_screening: 3,
  };
  const completedThrough: Partial<Record<AnalysisStatus, number>> = {
    analyzing_emotions: 0,
    classifying_distress: 1,
    estimating_screening: 2,
    generating_recommendation: 3,
    aggregating_week: 3,
    completed: 3,
  };
  const inferredCompleted = status === "retrying" || status === "failed"
    ? progress >= 55 ? 3 : progress >= 45 ? 2 : progress >= 35 ? 1 : progress >= 25 ? 0 : -1
    : completedThrough[status] ?? -1;

  const checks = order.map<AnalysisCheckProgress>((id, index) => {
    if (status === "safety_action_required" && index === 0) {
      return { id, state: "attention_required", detail: "Support options are ready" };
    }
    if (status === "failed" && index === inferredCompleted + 1) {
      return { id, state: "failed", detail: "This check could not finish" };
    }
    if (index <= inferredCompleted) return { id, state: "complete", detail: textCheckDetails[id] };
    if (runningIndex[status] === index) {
      const detail = index === 0 ? "Checking for support needs" : index === 1 ? "Reading emotional patterns" : index === 2 ? "Estimating distress" : "Estimating a symptom range";
      return { id, state: "running", detail };
    }
    return { id, state: "pending", detail: "Waiting" };
  });
  return [...checks, facialCheck(facialStatus)];
}
