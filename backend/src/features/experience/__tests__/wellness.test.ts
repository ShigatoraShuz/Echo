import { describe, expect, it } from "vitest";
import { scorePhq8 } from "@echo/contracts";
import { isAssessmentDue, assessmentDueAt } from "../wellness.service.js";
describe("PHQ-8 scoring and schedule", () => {
  it.each([
    [0, "minimal"],
    [4, "minimal"],
    [5, "mild"],
    [9, "mild"],
    [10, "moderate"],
    [14, "moderate"],
    [15, "moderately_severe"],
    [19, "moderately_severe"],
    [20, "severe"],
    [24, "severe"],
  ])("scores %s as %s", (total, band) => {
    let remaining = Number(total);
    const answers = Array.from({ length: 8 }, () => {
      const value = Math.min(3, remaining);
      remaining -= value;
      return value;
    });
    expect(scorePhq8(answers)).toEqual({ score: total, severity: band });
  });
  it("rejects missing, fractional, negative and out-of-range answers", () => {
    for (const answers of [
      [],
      Array(7).fill(0),
      [0.5, ...Array(7).fill(0)],
      [-1, ...Array(7).fill(0)],
      [4, ...Array(7).fill(0)],
    ])
      expect(() => scorePhq8(answers)).toThrow();
  });
  it("handles first use, exact seven-day boundary, and configured three-day interval", () => {
    const completed = "2026-09-01T14:00:00.000Z";
    expect(isAssessmentDue(null, 7)).toBe(true);
    expect(assessmentDueAt(completed, 7)).toBe("2026-09-08T14:00:00.000Z");
    expect(isAssessmentDue(completed, 7, Date.parse("2026-09-08T13:59:59.999Z"))).toBe(false);
    expect(isAssessmentDue(completed, 7, Date.parse("2026-09-08T14:00:00Z"))).toBe(true);
    expect(isAssessmentDue(completed, 3, Date.parse("2026-09-04T14:00:00Z"))).toBe(true);
  });
});
