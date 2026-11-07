import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { journalAnalysisV2ResultSchema, journalAnalysisV3ResultSchema, type JournalAnalysisResult } from "@echo/contracts";
import nativeFixture from "../../../../../packages/contracts/fixtures/core-v2.json";
import { DashboardDistressGauge } from "./dashboard-distress-gauge";

describe("dashboard distress gauge", () => {
  it("does not turn a native dataset category or confidence into severity", () => {
    const native = journalAnalysisV2ResultSchema.parse(nativeFixture);
    const view = render(<DashboardDistressGauge result={native} />);
    expect(screen.getByRole("img", {name: "Distress level: Not estimated"})).toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(view.container).not.toHaveTextContent(native.distressCategory);
    expect(screen.getByText(/No level is assumed/)).toBeInTheDocument();
    expect(screen.getByRole("link", {name: "About this reading"})).toHaveAttribute("href", "/insights/risk");
  });
  it("never renders a missing result as low distress", () => {
    render(<DashboardDistressGauge />);
    expect(screen.getByRole("img", {name: "Distress level: No analysis yet"})).toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
  const legacy = { schemaVersion: "echo-journal-analysis-v1", isSimulated: false, distressBand: "moderate" } as Extract<JournalAnalysisResult, {schemaVersion: "echo-journal-analysis-v1"}>;
  it("positions the needle only for an actual saved distress band, and updates it", () => {
    const view = render(<DashboardDistressGauge result={legacy} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "moderate");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "2");
    view.rerender(<DashboardDistressGauge result={{...legacy, distressBand: "high"} as JournalAnalysisResult} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "high");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "3");
  });
  it("does not present a simulated band as the user's reading", () => {
    render(<DashboardDistressGauge result={{...legacy, isSimulated:true}} />);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.getByText("Sample only")).toBeInTheDocument();
  });
});

const estimate = {
  status: "available", band: "high", experimental: true,
  method: "seallms-base-prompt", inferenceVersion: "journal-distress-rubric-v1",
  baseModel: "SeaLLMs/SeaLLMs-v3-7B-Chat", modelVersion: "a".repeat(64),
} as const;
function promptedResult(value: object) {
  return journalAnalysisV3ResultSchema.parse({ ...nativeFixture, schemaVersion: "echo-journal-analysis-v3",
    journalScreening: { status: "unavailable", experimental: true, inferenceVersion: "test", items: null, coverage: 0, subtotal: null, total: null },
    distressEstimate: value,
  });
}
it.each(["low", "mild", "moderate", "high", "severe"] as const)("displays the saved prompted %s band with its experimental label", band => {
  render(<DashboardDistressGauge result={promptedResult({ ...estimate, band })} />);
  expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", band);
  expect(screen.getByText("Experimental AI estimate")).toBeVisible();
  expect(screen.getByText(/Not a clinical assessment or safety rating/)).toBeVisible();
});
it.each(["insufficient_evidence", "unavailable", "failed"])("never displays %s estimation as low distress", status => {
  render(<DashboardDistressGauge result={promptedResult({ ...estimate, status, band: null })} />);
  expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Distress level: Not estimated" })).toBeVisible();
});
it("rejects invented confidence, missing provenance and invalid status/band combinations", () => {
  expect(() => promptedResult({ ...estimate, confidence: 0.99 })).toThrow();
  expect(() => promptedResult({ ...estimate, modelVersion: undefined })).toThrow();
  expect(() => promptedResult({ ...estimate, status: "failed" })).toThrow();
  expect(() => promptedResult({ ...estimate, experimental: false })).toThrow();
});
