import { describe, expect, it } from "vitest";
import { analysisProgressFor, assertAnalysisTransition } from "./analysis-state-machine.js";

describe("analysis state machine", () => {
  it("requires current gates before waiting jobs may requeue", () => {
    expect(() => assertAnalysisTransition("waiting_for_provider", "queued")).toThrow();
    expect(() =>
      assertAnalysisTransition("waiting_for_provider", "queued", { currentGatesChecked: true }),
    ).not.toThrow();
  });
  it("requires an allowed attempt before retrying jobs may requeue", () => {
    expect(() => assertAnalysisTransition("retrying", "queued")).toThrow();
    expect(() => assertAnalysisTransition("retrying", "queued", { attemptAllowed: true })).not.toThrow();
  });
  it("pauses safety processing until a reviewed transition", () => {
    expect(() => assertAnalysisTransition("safety_action_required", "analyzing_emotions")).toThrow();
    expect(() =>
      assertAnalysisTransition("safety_action_required", "analyzing_emotions", { reviewedSafety: true }),
    ).not.toThrow();
  });
  it("rejects every terminal progress mutation", () => {
    expect(() => assertAnalysisTransition("completed", "analyzing_emotions")).toThrow();
    expect(() => assertAnalysisTransition("failed", "queued")).toThrow();
    expect(() => assertAnalysisTransition("completed", "completed")).toThrow();
  });
  it("keeps public progress monotonic across all three attempts", () => {
    const first = analysisProgressFor("generating_recommendation", 1);
    const retry = analysisProgressFor("retrying", 1, first);
    const queued = analysisProgressFor("queued", 2, retry);
    const next = analysisProgressFor("safety_checking", 2, queued);
    expect([first, retry, queued, next]).toEqual([55, 70, 70, 72]);
    expect(analysisProgressFor("safety_checking", 3, 92)).toBe(93);
  });
});
