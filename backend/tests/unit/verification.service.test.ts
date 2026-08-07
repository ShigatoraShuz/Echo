import { describe, expect, it } from "vitest";
import {
  calculateAge,
  requiredDocumentKinds,
} from "../../src/features/verification/verification.service.js";

describe("verification rules", () => {
  it("calculates age without advancing before the birthday", () => {
    expect(calculateAge("2008-07-26", new Date("2026-07-25T12:00:00.000Z"))).toBe(17);
    expect(calculateAge("2008-07-25", new Date("2026-07-25T12:00:00.000Z"))).toBe(18);
  });

  it("requires guardian evidence for minors and a government ID for adults", () => {
    expect(requiredDocumentKinds(true)).toEqual([
      "user_age_document",
      "guardian_government_id",
      "guardianship_document",
    ]);
    expect(requiredDocumentKinds(false)).toEqual(["user_government_id"]);
  });
});
