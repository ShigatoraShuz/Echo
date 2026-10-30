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
export const analysisModeSchema = z.enum(["disabled", "development_stub", "local_worker", "local_json"]);
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
export const analysisInsightRangeSchema = z.enum(["7d", "30d", "90d", "custom"]);

const modelEmotionOutputSchema = z
  .object({
    emotionDistribution: z
      .array(z.object({ emotion: emotionNameSchema, value: z.number().min(0).max(1) }).strict())
      .length(6),
    dominantEmotion: emotionNameSchema,
    confidence: z.number().min(0).max(1),
    providerName: z.string().trim().min(1).max(80),
    modelVersion: z.string().trim().min(1).max(120),
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
    const maximum = Math.max(...result.emotionDistribution.map((item) => item.value));
    if (!result.emotionDistribution.some((item) => item.emotion === result.dominantEmotion && item.value === maximum))
      context.addIssue({
        code: "custom",
        path: ["dominantEmotion"],
        message: "Dominant emotion must have the highest distribution value.",
      });
  });

export const sanctuaryPerspectiveSchema = z
  .object({
    headline: z.string().trim().min(1).max(160),
    narrative: z.string().trim().min(1).max(2_000),
    providerName: z.string().trim().min(1).max(80),
    modelVersion: z.string().trim().min(1).max(120),
    isSimulated: z.boolean(),
  })
  .strict();

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

export const journalAnalysisV1ResultSchema = z
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
    /** Reserved for a validated text + facial fusion provider. Text-only output remains above. */
    combinedEmotionAnalysis: modelEmotionOutputSchema.nullable().optional(),
    /** Optional LLM reflection persisted with the result after provider validation. */
    sanctuaryPerspective: sanctuaryPerspectiveSchema.nullable().optional(),
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

export const plutchikEmotionSchema = z.enum([
  "joy",
  "trust",
  "fear",
  "surprise",
  "sadness",
  "disgust",
  "anger",
  "anticipation",
]);
export const distressCategorySchema = z.enum(["Others", "Anxious", "Depressed", "Frustrated", "Suicidal"]);
export const goEmotionNameSchema = z.enum([
  "admiration",
  "amusement",
  "anger",
  "annoyance",
  "approval",
  "caring",
  "confusion",
  "curiosity",
  "desire",
  "disappointment",
  "disapproval",
  "disgust",
  "embarrassment",
  "excitement",
  "fear",
  "gratitude",
  "grief",
  "joy",
  "love",
  "nervousness",
  "optimism",
  "pride",
  "realization",
  "relief",
  "remorse",
  "sadness",
  "surprise",
]);
const provenanceSchema = z
  .object({ providerName: z.string().min(1), modelVersion: z.string().min(1), inferenceVersion: z.string().min(1) })
  .strict();
const nativeDistributionSchema = z
  .array(z.object({ emotion: plutchikEmotionSchema, value: z.number().min(0).max(1) }).strict())
  .length(8);
export const journalAnalysisV2ResultSchema = z
  .object({
    schemaVersion: z.literal("echo-journal-analysis-v2"),
    thresholdVersion: z.string().min(1).max(80),
    providerName: z.string().min(1).max(80),
    modelVersion: z.string().min(1).max(120),
    isSimulated: z.literal(false),
    emotionDistribution: nativeDistributionSchema,
    dominantEmotion: plutchikEmotionSchema,
    emotionConfidence: z.number().min(0).max(1),
    distressBand: z.null(),
    distressConfidence: z.null(),
    depressiveSymptomRange: z.null(),
    distressCategory: distressCategorySchema,
    categoryScores: z
      .object({
        Others: z.number().min(0).max(1),
        Anxious: z.number().min(0).max(1),
        Depressed: z.number().min(0).max(1),
        Frustrated: z.number().min(0).max(1),
        Suicidal: z.number().min(0).max(1),
      })
      .strict(),
    goEmotions: z.record(goEmotionNameSchema, z.number().min(0).max(1)),
    supportReviewRequired: z.boolean(),
    classificationMetadata: z
      .object({
        maxLength: z.literal(384),
        stride: z.literal(64),
        threshold: z.number().min(0).max(1),
        windowCount: z.number().int().positive(),
        declaredLanguage: z.enum(["en", "fil", "taglish", "unknown"]),
      })
      .strict(),
    models: z.object({ xlmr: provenanceSchema, e4: provenanceSchema }).strict(),
    recommendationFeatures: z
      .array(
        z.enum(["paced_breathing", "grounding", "behavioral_activation", "thought_reframing", "support_connection"]),
      )
      .min(1)
      .max(5),
    facialExpressionAnalysis: z.null(),
    combinedEmotionAnalysis: z.null().optional(),
    sanctuaryPerspective: z.null().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const emotions = value.emotionDistribution;
    if (
      new Set(emotions.map((x) => x.emotion)).size !== 8 ||
      Math.abs(emotions.reduce((s, x) => s + x.value, 0) - 1) > 0.001
    )
      context.addIssue({ code: "custom", message: "Expected eight unique normalized emotions." });
    if (
      !emotions.some(
        (x) => x.emotion === value.dominantEmotion && x.value === Math.max(...emotions.map((v) => v.value)),
      )
    )
      context.addIssue({ code: "custom", message: "Dominant emotion must have the highest score." });
    const scores = Object.values(value.categoryScores);
    if (
      Math.abs(scores.reduce((s, x) => s + x, 0) - 1) > 0.001 ||
      value.categoryScores[value.distressCategory] !== Math.max(...scores)
    )
      context.addIssue({ code: "custom", message: "Invalid five-category distribution." });
  });
export const screeningItemsSchema = z
  .object(
    Object.fromEntries(
      [
        "anhedonia",
        "depressed_mood",
        "sleep",
        "fatigue",
        "appetite",
        "worthlessness_guilt",
        "concentration",
        "psychomotor",
      ].map((k) => [k, z.number().int().min(0).max(3).nullable()]),
    ) as Record<
      | "anhedonia"
      | "depressed_mood"
      | "sleep"
      | "fatigue"
      | "appetite"
      | "worthlessness_guilt"
      | "concentration"
      | "psychomotor",
      z.ZodNullable<z.ZodNumber>
    >,
  )
  .strict();
export const journalScreeningSchema = z
  .object({
    generatedAt: z.string().datetime().optional(),
    status: z.enum(["available", "unavailable", "failed"]),
    experimental: z.literal(true),
    inferenceVersion: z.string(),
    items: screeningItemsSchema.nullable(),
    coverage: z.number().int().min(0).max(8),
    subtotal: z.number().int().min(0).max(24).nullable(),
    total: z.number().int().min(0).max(24).nullable(),
    modelFingerprint: z.string().optional(),
    truncated: z.boolean().optional(),
    inputTokens: z.number().int().optional(),
    retainedTokens: z.number().int().optional(),
  })
  .strict()
  .superRefine((v, c) => {
    const nums = v.items ? Object.values(v.items).filter((x): x is number => x !== null) : [];
    const sum = nums.reduce((a, b) => a + b, 0);
    if (
      (v.status === "available") !== (v.items !== null) ||
      v.coverage !== nums.length ||
      v.subtotal !== (nums.length ? sum : null) ||
      v.total !== (nums.length === 8 ? sum : null)
    )
      c.addIssue({ code: "custom", message: "Invalid nullable screening arithmetic" });
  });
export const journalAnalysisV3ResultSchema = z
  .object({
    ...journalAnalysisV2ResultSchema.shape,
    schemaVersion: z.literal("echo-journal-analysis-v3"),
    journalScreening: journalScreeningSchema,
  })
  .strict()
  .superRefine((v, c) => {
    const { journalScreening, ...native } = v;
    const checked = journalAnalysisV2ResultSchema.safeParse({ ...native, schemaVersion: "echo-journal-analysis-v2" });
    if (!checked.success)
      for (const issue of checked.error.issues)
        c.addIssue({ code: "custom", message: issue.message, path: issue.path });
  });
export const journalAnalysisResultSchema = z.union([
  journalAnalysisV1ResultSchema,
  journalAnalysisV2ResultSchema,
  journalAnalysisV3ResultSchema,
]);

export const journalSubmissionResponseSchema = z.object({
  storage: z.enum(["local_json", "supabase"]).optional(),
  journalId: z.string().uuid(),
  analysisJobId: z.string().uuid(),
  status: z.enum(["queued", "waiting_for_provider"]),
  facialStatus: facialAnalysisStatusSchema.default("not_requested"),
});

export const dashboardInsightsSchema = z.object({
  journalScreeningTrend: z
    .array(
      z.object({
        date: z.string(),
        status: z.enum(["available", "unavailable", "failed"]),
        coverage: z.number().int().min(0).max(8),
        subtotal: z.number().nullable(),
        total: z.number().nullable(),
      }),
    )
    .optional(),
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
      schemaVersion: z
        .enum(["echo-journal-analysis-v1", "echo-journal-analysis-v2", "echo-journal-analysis-v3"])
        .optional(),
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
  period: z
    .object({
      range: analysisInsightRangeSchema,
      from: z.string().date(),
      to: z.string().date(),
      analyzedReflectionCount: z.number().int().min(0),
    })
    .strict()
    .optional(),
  facialStatus: facialAnalysisStatusSchema.optional(),
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
export type AnalysisInsightRange = z.infer<typeof analysisInsightRangeSchema>;
export type SanctuaryPerspective = z.infer<typeof sanctuaryPerspectiveSchema>;

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
  const inferredCompleted =
    status === "retrying" || status === "failed"
      ? progress >= 55
        ? 3
        : progress >= 45
          ? 2
          : progress >= 35
            ? 1
            : progress >= 25
              ? 0
              : -1
      : (completedThrough[status] ?? -1);

  const checks = order.map<AnalysisCheckProgress>((id, index) => {
    if (status === "safety_action_required" && index === 0) {
      return { id, state: "attention_required", detail: "Support options are ready" };
    }
    if (status === "failed" && index === inferredCompleted + 1) {
      return { id, state: "failed", detail: "This check could not finish" };
    }
    if (index <= inferredCompleted) return { id, state: "complete", detail: textCheckDetails[id] };
    if (runningIndex[status] === index) {
      const detail =
        index === 0
          ? "Checking for support needs"
          : index === 1
            ? "Reading emotional patterns"
            : index === 2
              ? "Estimating distress"
              : "Estimating a symptom range";
      return { id, state: "running", detail };
    }
    return { id, state: "pending", detail: "Waiting" };
  });
  return [...checks, facialCheck(facialStatus)];
}
