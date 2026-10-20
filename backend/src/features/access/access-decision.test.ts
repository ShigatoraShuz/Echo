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
  let finishPolicies!: (value: { data: typeof policies }) => void;
  let finishConsents!: (value: { data: typeof consents }) => void;
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
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {
            account_status: "active",
            eligible_18_plus: true,
            eligibility_verified_at: "2026-01-01T00:00:00Z",
            onboarding_completed: true,
          }, error: null }) }) }),
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
  await expect(decision).resolves.toEqual({ decision: "ACCESS_GRANTED", onboardingStep: 3 });
});
