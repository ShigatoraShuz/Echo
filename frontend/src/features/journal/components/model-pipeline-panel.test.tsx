import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { modelPipelineResultSchema } from "@echo/contracts";
import fixture from "../../../../../packages/contracts/fixtures/model-pipeline-v2.synthetic.json";
import { ModelPipelinePanel } from "./model-pipeline-panel";

describe("independent model results", () => {
  it("keeps real raw logits separate from unavailable clinical classifiers without adding percentages", () => {
    const research = { ...fixture, isSimulated: false, overallStatus: "partial",
      stages: Object.fromEntries(Object.entries(fixture.stages).map(([key, stage]) => [key, {
        ...stage, executionMode: "real", status: "unavailable", result: null, errorCode: "MODEL_NOT_ENABLED",
      }])), researchDiagnostic: { executionState: "REAL_PROVISIONAL_MODEL", modelId: "echo-xlmr-v2-distress-raw", modelVersion: "provisional-20261030-format-v1",
      labels: ["Others", "Anxious", "Depressed", "Frustrated", "Suicidal"], rawLogits: [5, -2, -1, 0, -3], inputTokens: 12, windows: 1,
      calibrationApplied: false, calibrationBinding: "mismatch_unresolved", preprocessingVerified: false, classificationSemanticsVerified: false, trainingReferenceParityVerified: false,
      clinicalUseAllowed: false, repeatConsistent: true, validationAndLoadMs: 10, forwardMs: [5, 4] } };
    render(<ModelPipelinePanel result={modelPipelineResultSchema.parse(research)} />);
    expect(screen.getByText(/Dataset class names are not diagnoses/)).toBeInTheDocument();
    expect(screen.getByText("5.00000 raw logit")).toBeInTheDocument();
    expect(screen.getByText(/Calibration hash mismatch remains unresolved/)).toBeInTheDocument();
    expect(screen.queryByText(/100.0%/)).not.toBeInTheDocument();
  });
  it("does not assign an unverified PEAK identity and labels real mode as provisional", () => {
    const research = structuredClone(fixture);
    research.isSimulated = false;
    Object.values(research.stages).forEach((stage) => {
      stage.executionMode = "real";
    });
    research.stages.peak.modelId = "research/e4-custom-emotion";
    research.stages.peak.modelVersion = "provisional-test-only";
    render(<ModelPipelinePanel result={modelPipelineResultSchema.parse(research)} />);
    expect(screen.getByText("Text emotion")).toBeInTheDocument();
    expect(screen.getByText(/Provisional research outputs — not clinically validated/)).toBeInTheDocument();
    expect(screen.getByText("research/e4-custom-emotion @ provisional-test-only")).toBeInTheDocument();
    expect(screen.queryByText(/PEAK text emotion/)).not.toBeInTheDocument();
  });
  it("labels synthetic execution and partial PHQ estimates without severity or full totals", () => {
    render(<ModelPipelinePanel result={modelPipelineResultSchema.parse(fixture)} />);
    expect(screen.getByText(/SYNTHETIC E2E FIXTURE — fictional outputs/)).toBeInTheDocument();
    expect(screen.getByText("Partial subtotal: 6")).toBeInTheDocument();
    expect(screen.getByText("4 of 8 symptoms scored")).toBeInTheDocument();
    expect(screen.getAllByText("Unknown")).toHaveLength(4);
    expect(screen.queryByText(/Model-estimated total:/)).not.toBeInTheDocument();
    expect(screen.getByText(/No complete score or severity/)).toBeInTheDocument();
  });
  it("preserves classifier output when generation is unavailable", () => {
    const partial = structuredClone(fixture);
    partial.overallStatus = "partial";
    partial.stages.cbt = {
      ...partial.stages.cbt,
      status: "unavailable",
      result: null,
      errorCode: "BASE_WEIGHTS_MISSING",
    } as never;
    render(<ModelPipelinePanel result={modelPipelineResultSchema.parse(partial)} />);
    expect(screen.getByText("fixture_emotion_a")).toBeInTheDocument();
    expect(screen.getByText(/Unavailable: base weights missing/)).toBeInTheDocument();
    expect(screen.getByText(/Support mapping unavailable/)).toBeInTheDocument();
    expect(screen.queryByText(/Synthetic test response:/)).not.toBeInTheDocument();
  });
  it("renders face unavailable and separates static resources from generated text", () => {
    render(<ModelPipelinePanel result={modelPipelineResultSchema.parse(fixture)} />);
    expect(screen.getByText(/Trusted face export is not ready/)).toBeInTheDocument();
    expect(screen.getByText(/separately reviewed static resource/)).toBeInTheDocument();
  });
});
