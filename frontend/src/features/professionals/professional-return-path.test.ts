import { describe, expect, it } from "vitest";
import { professionalOrganizationDestination, professionalReturnPath } from "./professional-return-path";

describe("professional return path", () => {
  it("keeps only workspace and case deep links", () => {
    expect(professionalReturnPath("/professional?organization=one")).toBe("/professional?organization=one");
    expect(professionalReturnPath("/professional/requests?organization=one")).toBe("/professional/requests?organization=one");
    expect(professionalReturnPath("/professional/my-cases?organization=one#cases")).toBe("/professional/my-cases?organization=one#cases");
    expect(professionalReturnPath("/professional/calendar?organization=one")).toBe("/professional/calendar?organization=one");
    expect(professionalReturnPath("/professional/resources?organization=one")).toBe("/professional/resources?organization=one");
    expect(professionalReturnPath("/professional/cases/fe000000-0000-4000-8000-000000000001")).toContain("/cases/");
    for (const unsafe of ["//evil.test", "/professional/request", "/professional/access", "/professional/cases/invalid", "/dashboard"]) {
      expect(professionalReturnPath(unsafe)).toBe("/professional");
    }
  });

  it("preserves safe queue/case-list destinations while choosing an approved organization", () => {
    expect(professionalOrganizationDestination("/professional/my-cases?organization=old#cases", "new")).toBe("/professional/my-cases?organization=new#cases");
    expect(professionalOrganizationDestination("https://evil.test/", "new")).toBe("/professional?organization=new");
    expect(professionalReturnPath("/professional/my-cases/admin")).toBe("/professional");
    expect(professionalOrganizationDestination("/professional/calendar?organization=old", "new")).toBe("/professional/calendar?organization=new");
    expect(professionalOrganizationDestination("/professional/resources", "new")).toBe("/professional/resources?organization=new");
  });
});
