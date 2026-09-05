import { describe, expect, it } from "vitest";
import { AccessService } from "./access.service.js";

const policies = ["terms_of_use", "privacy_notice", "ai_analysis_notice"].map((document_type) => ({ document_type, version: "v1" }));
const consents = ["terms_of_use", "privacy_policy", "ai_feature_notice"].map((consent_type) => ({ consent_type, consent_version: "v1", accepted: true }));
const active = { account_status: "active", eligible_18_plus: true, eligibility_verified_at: "2026-09-05", onboarding_completed: true };

function fixture(profile: Record<string, unknown> = active, accepted = consents, failed = false) {
  const filters: unknown[][] = [];
  const database = { from(table: string) {
    const data = table === "profiles" ? profile : table === "user_consents" ? accepted : policies;
    const result = { data, error: failed ? { message: "unavailable" } : null };
    const query: any = {
      select: () => query, eq: () => query,
      is: (...args: unknown[]) => { filters.push(args); return query; },
      maybeSingle: async () => result,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    return query;
  } };
  return { service: new AccessService(database as any), filters };
}

describe("Account access decisions", () => {
  it.each([
    [{ ...active, account_status: "suspended" }, "ACCOUNT_UNAVAILABLE"],
    [{ ...active, eligible_18_plus: null }, "AGE_VERIFICATION_REQUIRED"],
    [{ ...active, onboarding_completed: false }, "ONBOARDING_REQUIRED"],
    [active, "ACCESS_GRANTED"],
  ])("checks account gates in order", async (profile, decision) => {
    await expect(fixture(profile as Record<string, unknown>).service.decide("owner")).resolves.toMatchObject({ decision });
  });
  it("requires all current policy versions and excludes revoked consent", async () => {
    const { service, filters } = fixture(active, consents.slice(1));
    await expect(service.decide("owner")).resolves.toMatchObject({ decision: "POLICY_REVIEW_REQUIRED" });
    expect(filters).toContainEqual(["revoked_at", null]);
  });
  it("does not grant access when the database fails", async () => {
    await expect(fixture(active, consents, true).service.decide("owner")).rejects.toThrow("could not be checked");
  });
  it("rejects an impossible birthday and an underage applicant", async () => {
    const { service } = fixture();
    await expect(service.verifyLegacyAge("owner", "2000-02-31")).rejects.toThrow();
    await expect(service.verifyLegacyAge("owner", "2020-01-01")).rejects.toThrow();
  });
});
