import { describe, expect, it } from "vitest";
import { professionalReturnPath } from "./professional-return-path";

describe("professional return path", () => {
  it("keeps only workspace and case deep links", () => {
    expect(professionalReturnPath("/professional?organization=one")).toBe("/professional?organization=one");
    expect(professionalReturnPath("/professional/cases/fe000000-0000-4000-8000-000000000001")).toContain("/cases/");
    for (const unsafe of ["//evil.test", "/professional/request", "/professional/access", "/professional/cases/invalid", "/dashboard"]) {
      expect(professionalReturnPath(unsafe)).toBe("/professional");
    }
  });
});
