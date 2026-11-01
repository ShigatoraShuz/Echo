import { describe, expect, it } from "vitest";
import native from "../../../../../packages/contracts/fixtures/core-v2.json";
import pipeline from "../../../../../packages/contracts/fixtures/model-pipeline-v2.synthetic.json";
import { journalAnalysisV2ResultSchema, journalAnalysisV3ResultSchema, modelPipelineResultSchema } from "@echo/contracts";
import { analysisSummary, analysisRequestMessage } from "./analysis-summary";

const nativeResult = journalAnalysisV2ResultSchema.parse(native);
describe("persisted analysis summary mapping", () => {
  it("keeps native categories separate from severity", () => {
    expect(analysisSummary(nativeResult)).toMatchObject({ status: "complete", emotion: native.dominantEmotion, distress: native.distressCategory, distressKind: "category" });
  });
  it("does not turn absent results into zero", () => {
    expect(analysisSummary(null)).toMatchObject({ status: "unavailable", emotion: null, distress: null });
  });
  it("keeps nullable screening partial while retaining successful emotion outputs", () => {
    const result = journalAnalysisV3ResultSchema.parse({ ...native, schemaVersion: "echo-journal-analysis-v3", journalScreening: {
      status: "unavailable", experimental: true, inferenceVersion: "fictional-test", items: null, coverage: 0, subtotal: null, total: null,
    } });
    expect(analysisSummary(result)).toMatchObject({ status: "partial", emotion: native.dominantEmotion });
  });
  it("uses independent pipeline outputs without clinical fusion", () => {
    const result = modelPipelineResultSchema.parse(pipeline);
    expect(analysisSummary(result)).toMatchObject({ status: result.overallStatus === "completed" ? "complete" : result.overallStatus, distress: result.stages.distress.result?.topFive[0]?.label, distressKind: "category" });
  });
  it.each([ ["queued", /pending/], ["failed", /failed/], ["waiting_for_provider", /unavailable/], ["safety_action_required", /attention/] ] as const)("distinguishes %s", (status, text) => {
    expect(analysisRequestMessage({ latestRequest: { status, updatedAt: "2026-10-31" } } as never)).toMatch(text);
  });
});
