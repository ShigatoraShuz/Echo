import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AccessService } from "./access.service.js";

const user = { id: "user-1", emailVerified: true };
const policies = ["terms", "privacy", "ai"].map((document_type) => ({ document_type, version: "1" }));
const consents = policies.map((policy) => ({
  consent_type: policy.document_type,
  consent_version: policy.version,
  accepted: true,
}));

it("starts independent policy reads together and grants access only after both complete", async () => {
  let finishProfile!: (value: { data: Record<string, unknown>; error: null }) => void;
  let finishPolicies!: (value: { data: typeof policies }) => void;
  let finishConsents!: (value: { data: typeof consents }) => void;
  const profileResult = new Promise<{ data: Record<string, unknown>; error: null }>((resolve) => { finishProfile = resolve; });
  const policyResult = new Promise<{ data: typeof policies }>((resolve) => { finishPolicies = resolve; });
  const consentResult = new Promise<{ data: typeof consents }>((resolve) => { finishConsents = resolve; });
  const queried: string[] = [];
  const database = {
    schema: vi.fn().mockReturnThis(),
    from: vi.fn((table: string) => {
      queried.push(table);
      if (table === "account_deletion_requests") {
        return { select: () => ({ eq: () => ({ in: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) };
      }
      if (table === "profiles") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => profileResult }) }),
        };
      }
      if (table === "policy_documents") return { select: () => ({ eq: () => policyResult }) };
      return { select: () => ({ eq: () => ({ eq: () => consentResult }) }) };
    }),
  };
  const decision = new AccessService(database as unknown as SupabaseClient).decide(user);
  await vi.waitFor(() => expect(queried).toEqual(["account_deletion_requests", "profiles", "policy_documents", "user_consents"]));
  finishPolicies({ data: policies });
  finishConsents({ data: consents });
  finishProfile({ data: {
    account_status: "active", eligible_18_plus: true,
    eligibility_verified_at: "2026-01-01T00:00:00Z", onboarding_completed: true,
  }, error: null });
  await expect(decision).resolves.toEqual({ decision: "ACCESS_GRANTED", onboardingStep: 3 });
});

it("fails closed when policy data cannot be read", async () => {
  const database = {
    schema: vi.fn().mockReturnThis(),
    from: vi.fn((table: string) => {
      if (table === "account_deletion_requests")
        return { select: () => ({ eq: () => ({ in: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) };
      if (table === "profiles")
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {
          account_status: "active", eligible_18_plus: true,
          eligibility_verified_at: "2026-01-01T00:00:00Z", onboarding_completed: true,
        }, error: null }) }) }) };
      if (table === "policy_documents")
        return { select: () => ({ eq: async () => ({ data: null, error: { message: "offline" } }) }) };
      return { select: () => ({ eq: () => ({ eq: async () => ({ data: consents, error: null }) }) }) };
    }),
  };
  await expect(new AccessService(database as unknown as SupabaseClient).decide(user))
    .rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE" });
});

it("keeps deletion precedence if the parallel profile read fails", async () => {
  const database = {
    schema: vi.fn().mockReturnThis(),
    from: vi.fn((table: string) => {
      if (table === "profiles")
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.reject(new Error("profile offline")) }) }) };
      if (table === "account_deletion_requests")
        return { select: () => ({ eq: () => ({ in: () => ({ limit: async () => ({ data: [{ id: "pending" }], error: null }) }) }) }) };
      if (table === "policy_documents")
        return { select: () => ({ eq: () => new Promise(() => {}) }) };
      return { select: () => ({ eq: () => ({ eq: async () => ({ data: consents, error: null }) }) }) };
    }),
  };
  const service = new AccessService(database as unknown as SupabaseClient);
  await expect(service.decide(user)).resolves.toEqual({ decision: "DELETION_PENDING", onboardingStep: 0 });
});
