import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "@/infrastructure/api/api-client";
import type { Membership } from "@/services/professionals/professional-api";
import { membershipAccessFailure, professionalAccessDestination, professionalAccessFailure, professionalLoginDestination } from "./professional-access-feedback";

afterEach(() => vi.unstubAllGlobals());

describe("professional access feedback against the current API envelope", () => {
  it.each([
    [401, "AUTHENTICATION_REQUIRED", "session"],
    [401, "INVALID_ACCESS_TOKEN", "session"],
    [403, "RESOURCE_FORBIDDEN", "denied"],
    [403, "MFA_REQUIRED", "mfa"],
    [403, "REAUTHENTICATION_REQUIRED", "reauth"],
    [404, "NOT_FOUND", "unavailable"],
    [429, "RATE_LIMITED", "rate"],
    [503, "DATABASE_UNAVAILABLE", "server"],
    [400, "VALIDATION_ERROR", "validation"],
    [409, "CONFLICT", "validation"],
  ])("maps %s / %s without exposing backend details", async (status, code, kind) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false, error: { code, message: "Private organization/case identifier", details: { secret: "not public" } }, meta: { requestId: "synthetic" },
    }), { status: Number(status), headers: { "content-type": "application/json" } })));
    const client = createApiClient({ baseUrl: "http://echo.example.test" });
    const error = await client.get("/professionals/me").catch((reason: unknown) => reason);
    const failure = professionalAccessFailure(error);
    expect(failure.kind).toBe(kind);
    expect(failure.message).not.toContain("Private");
    expect(failure.message).not.toContain("not public");
  });

  it("handles network failures and unknown errors without copying exception details", () => {
    expect(professionalAccessFailure(new TypeError("Failed to fetch")).kind).toBe("network");
    expect(professionalAccessFailure(new Error("Private diagnostic"))).toMatchObject({ kind: "unknown", retry: true });
    expect(professionalAccessFailure(new Error("Private diagnostic")).message).not.toContain("Private");
  });

  it.each([
    ["pending_membership", "pending"], ["pending_organization", "pending"],
    ["suspended_membership", "suspended"], ["suspended_organization", "suspended"],
    ["credential_expired", "expired"],
  ])("uses reported membership state %s without guessing from a 403", (accessState, kind) => {
    expect(membershipAccessFailure([{ accessState } as Membership]).kind).toBe(kind);
    expect(membershipAccessFailure([]).kind).toBe("unapproved");
  });

  it("preserves allowed destinations and blocks external paths and gateway loops", () => {
    const path = "/professional/cases/fe000000-0000-4000-8000-000000000001?organization=synthetic#notes";
    expect(professionalAccessDestination(path)).toBe(`/professional/access?next=${encodeURIComponent(path)}`);
    expect(professionalLoginDestination(path)).toBe(`/professional/login?error=sign_in_session_expired&next=${encodeURIComponent(path)}`);
    for (const candidate of ["https://external.test", "//external.test", "/professional/access", "/professional/login", "/professional/request", "/\\external.test"]) {
      expect(professionalAccessDestination(candidate)).toBe("/professional/access?next=%2Fprofessional");
    }
  });
});
