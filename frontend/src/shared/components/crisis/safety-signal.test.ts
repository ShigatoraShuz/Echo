import { it, expect } from "vitest";
import { shouldShowSupport } from "./safety-signal";
it("deduplicates an acknowledged support event across page renders", () =>
  expect(shouldShowSupport({ kind: "professional_support", eventId: "one" }, "one")).toBe(false));
it("shows a new support event", () =>
  expect(shouldShowSupport({ kind: "professional_support", eventId: "two" }, "one")).toBe(true));
it("never lets a prior support dismissal suppress a new immediate event", () =>
  expect(shouldShowSupport({ kind: "immediate", eventId: "urgent" }, "one")).toBe(true));
it("does not display the none signal", () =>
  expect(shouldShowSupport({ kind: "none", eventId: "one" }, null)).toBe(false));
