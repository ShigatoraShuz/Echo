import { z } from "zod";

export const executionStateSchema = z.enum(["REAL_PROVISIONAL_MODEL", "DEMO_FALLBACK", "UNAVAILABLE"]);
export const researchDiagnosticSchema = z.object({
  executionState: z.literal("REAL_PROVISIONAL_MODEL"),
  modelId: z.string().min(2).max(160),
  modelVersion: z.string().min(1).max(80),
  labels: z.array(z.string().min(1).max(120)).min(2).max(200),
  rawLogits: z.array(z.number().finite()).min(2).max(200),
  inputTokens: z.number().int().min(1).max(384),
  windows: z.literal(1),
  calibrationApplied: z.literal(false),
  preprocessingVerified: z.literal(false),
  classificationSemanticsVerified: z.literal(false),
  trainingReferenceParityVerified: z.literal(false),
  clinicalUseAllowed: z.literal(false),
  repeatConsistent: z.literal(true),
  validationAndLoadMs: z.number().int().min(0),
  forwardMs: z.array(z.number().int().min(0)).length(2),
  maxInputTokens: z.number().int().min(8).max(4096).optional(),
  calibrationBinding: z.enum(["mismatch_unresolved", "not_available", "unverified"]).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.labels.length !== value.rawLogits.length || new Set(value.labels).size !== value.labels.length)
    ctx.addIssue({ code: "custom", message: "Raw logits must match unique checkpoint-defined labels." });
});

const score = z.object({ label: z.string().min(1).max(120), probability: z.number().min(0).max(1) }).strict();
export const classifierResultSchema = z
  .object({
    scores: z.array(score).min(5).max(200),
    topFive: z.array(score).length(5),
    semantics: z.enum(["softmax", "sigmoid"]),
    calibration: z.string().min(10).max(2000),
    supportFlags: z.array(z.string().max(160)).max(30).nullable(),
    supportMappingReference: z.string().max(500).nullable(),
    windowsProcessed: z.number().int().min(1).max(32),
    truncated: z.boolean(),
  })
  .strict()
  .superRefine((result, ctx) => {
    if (new Set(result.scores.map((s) => s.label)).size !== result.scores.length)
      ctx.addIssue({ code: "custom", message: "Duplicate checkpoint labels." });
    if (
      result.semantics === "softmax" &&
      Math.abs(result.scores.reduce((sum, s) => sum + s.probability, 0) - 1) > 0.001
    )
      ctx.addIssue({ code: "custom", message: "Softmax scores must sum to one." });
    const ranked = [...result.scores].sort((a, b) => b.probability - a.probability).slice(0, 5);
    if (JSON.stringify(ranked) !== JSON.stringify(result.topFive))
      ctx.addIssue({ code: "custom", message: "Top five must match actual ranked checkpoint scores." });
    if (result.supportFlags !== null && !result.supportMappingReference)
      ctx.addIssue({ code: "custom", message: "Support flags require a reviewed mapping reference." });
  });
const item = z.number().int().min(0).max(3).nullable();
export const phq8EstimateSchema = z
  .object({
    items: z
      .object({
        anhedonia: item,
        depressed_mood: item,
        sleep: item,
        fatigue: item,
        appetite: item,
        worthlessness_guilt: item,
        concentration: item,
        psychomotor: item,
      })
      .strict(),
    scored_symptom_count: z.number().int().min(0).max(8),
    subtotal: z.number().int().min(0).max(24),
    complete: z.boolean(),
    total: z.number().int().min(0).max(24).nullable(),
    timeFrame: z.string().min(10).max(500),
    experimental: z.literal(true),
  })
  .strict()
  .superRefine((result, ctx) => {
    const values = Object.values(result.items).filter((n): n is number => n !== null);
    const subtotal = values.reduce((sum, n) => sum + n, 0),
      complete = values.length === 8;
    if (
      result.scored_symptom_count !== values.length ||
      result.subtotal !== subtotal ||
      result.complete !== complete ||
      result.total !== (complete ? subtotal : null)
    )
      ctx.addIssue({ code: "custom", message: "Invalid nullable PHQ-8 aggregation." });
  });
export const generationResultSchema = z
  .object({ text: z.string().min(1).max(6000), disclaimer: z.string().min(1).max(500) })
  .strict();
const stage = <T extends z.ZodType>(result: T) =>
  z
    .object({
      status: z.enum(["pending", "running", "completed", "unavailable", "failed", "skipped"]),
      modelId: z.string().max(160).nullable(),
      modelVersion: z.string().max(80).nullable(),
      executionMode: z.enum(["real", "synthetic"]),
      timestamp: z.string().datetime({ offset: true }),
      result: result.nullable(),
      errorCode: z.string().max(120).nullable(),
      durationMs: z.number().int().min(0),
      executionState: executionStateSchema.optional(),
    })
    .strict()
    .superRefine((value, ctx) => {
      const output = value as unknown as { result: unknown };
      if (value.executionState && value.executionState !== (value.status === "completed"
        ? value.executionMode === "synthetic" ? "DEMO_FALLBACK" : "REAL_PROVISIONAL_MODEL" : "UNAVAILABLE"))
        ctx.addIssue({ code: "custom", message: "Execution source and state disagree." });
      if (
        (value.status === "completed") !== (output.result !== null) ||
        (value.status === "completed" && (!value.modelId || !value.modelVersion || value.errorCode))
      )
        ctx.addIssue({ code: "custom", message: "Stage status and output metadata disagree." });
    });
export const generationStageSchema = stage(generationResultSchema);
export const modelPipelineResultSchema = z
  .object({
    schemaVersion: z.literal("echo-model-pipeline-v2"),
    thresholdVersion: z.literal("no-clinical-thresholds-v1"),
    providerName: z.literal("echo-local-model-registry"),
    modelVersion: z.literal("staged-v2"),
    isSimulated: z.boolean(),
    overallStatus: z.enum(["completed", "partial", "unavailable"]),
    stages: z
      .object({
        peak: stage(classifierResultSchema),
        distress: stage(classifierResultSchema),
        phq8: stage(phq8EstimateSchema),
        cbt: generationStageSchema,
        face: stage(z.never()),
      })
      .strict(),
    recommendationFeatures: z.array(z.literal("grounding")).length(1),
    staticResourceOnly: z.literal(true),
    researchDiagnostic: researchDiagnosticSchema.optional(),
    researchDiagnosticError: z.string().max(120).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const stages = Object.values(value.stages);
    if (stages.some((s) => (s.executionMode === "synthetic") !== value.isSimulated))
      ctx.addIssue({ code: "custom", message: "Mixed synthetic and real persistence is forbidden." });
    if (value.stages.distress.result && value.stages.distress.result.scores.length !== 5)
      ctx.addIssue({ code: "custom", message: "Distress requires exactly five checkpoint labels." });
    const completed = stages.filter((s) => s.status === "completed").length;
    if (value.researchDiagnostic && value.isSimulated)
      ctx.addIssue({ code: "custom", message: "Actual diagnostics cannot accompany synthetic results." });
    if (value.overallStatus !== (completed === 4 ? "completed" : completed || value.researchDiagnostic ? "partial" : "unavailable"))
      ctx.addIssue({ code: "custom", message: "Overall status does not match independent stages." });
  });
export type ModelPipelineResult = z.infer<typeof modelPipelineResultSchema>;
export type GenerationStage = z.infer<typeof generationStageSchema>;
