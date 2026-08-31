import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { JournalService, type JournalAnalysisRuntime } from "../journals.service.js";
import { createEncryptionService } from "../../../infrastructure/encryption/encryption.service.js";
import { createDisabledAnalysisProvider } from "../../../infrastructure/analysis/mock-analysis.provider.js";
import { IdempotencyService } from "../../../infrastructure/idempotency/idempotency.service.js";
import { DevelopmentAnalysisRunner } from "../../../infrastructure/analysis/development-analysis.runner.js";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const input = {
  title: "Private title",
  body: "Private body",
  mood: "calm" as const,
  emotions: [],
  tags: [],
  privacyStatus: "private" as const,
  analysisConsent: true,
};
function setup(
  mode: JournalAnalysisRuntime["mode"] = "disabled",
  overrides: Record<string, unknown> = {},
  production = false,
) {
  const policies = ["terms_of_use", "privacy_notice", "ai_analysis_notice"];
  const values: Record<string, unknown> = {
    idempotency_records: [],
    privacy_preferences: { journal_ai_analysis_enabled: true },
    profiles: { account_status: "active", onboarding_completed: true, eligible_18_plus: true },
    identity_verifications: { verification_status: "approved", approved_expires_at: "2099-01-01T00:00:00Z" },
    policy_documents: policies.map((document_type) => ({ document_type, version: "v1" })),
    user_consents: policies.map((consent_type) => ({ consent_type, consent_version: "v1", accepted: true })),
    worker_health: [],
    ...overrides,
  };
  const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => ({
    error: null,
    data:
      name === "submit_journal"
        ? [
            {
              journal_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              analysis_job_id: params.p_analysis_requested ? "dddddddd-dddd-4ddd-8ddd-dddddddddddd" : null,
              result_status: params.p_initial_status,
              replayed: false,
            },
          ]
        : null,
  }));
  const database = {
    schema: () => ({
      rpc,
      from: (table: string) => {
        const result = { data: values[table] ?? null, error: null };
        const chain = {
          select: () => chain,
          eq: () => chain,
          gt: () => chain,
          gte: () => chain,
          limit: () => chain,
          order: () => chain,
          maybeSingle: () => Promise.resolve(result),
          then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result)),
        };
        return chain;
      },
    }),
  } as unknown as SupabaseClient;
  const keys = new IdempotencyService("v1", { v1: "a-separate-idempotency-test-secret-32-long" });
  const runner = new DevelopmentAnalysisRunner(1);
  runner.stop();
  const service = new JournalService(
    database,
    createEncryptionService(Buffer.alloc(32, 4).toString("base64"), 1),
    createDisabledAnalysisProvider(),
    keys,
    { mode, isProduction: production, developmentUserIds: new Set([userId]), timeoutMs: 1000 },
    runner,
  );
  return { service, rpc, keys };
}
describe("submission service boundaries", () => {
  it.each(["disabled", "development_stub", "local_worker"] as const)(
    "private save never schedules analysis in %s mode",
    async (mode) => {
      const { service, rpc } = setup(mode);
      expect(await service.create(userId, { ...input, analysisConsent: false }, "idempotency-test-key")).toMatchObject({
        kind: "private",
      });
      expect(rpc.mock.calls[0][1]).toMatchObject({
        p_analysis_requested: false,
        p_title_sentinel: "[encrypted]",
        p_initial_status: "saved",
      });
      expect(JSON.stringify(rpc.mock.calls)).not.toMatch(/Private title|Private body|idempotency-test-key/);
    },
  );
  it.each([
    ["development_stub", "queued"],
    ["disabled", "waiting_for_provider"],
    ["local_worker", "waiting_for_provider"],
  ] as const)("%s requests the correct initial transaction status", async (mode, status) => {
    const { service } = setup(mode);
    expect(await service.create(userId, input, "idempotency-test-key")).toMatchObject({
      kind: "analysis",
      submission: { status },
    });
  });
  it("queues a local worker only with a recent accepting heartbeat", async () => {
    const { service } = setup("local_worker", { worker_health: [{ worker_id: "local-worker" }] });
    expect(await service.create(userId, input, "idempotency-test-key")).toMatchObject({
      submission: { status: "queued" },
    });
  });
  it("does not silently downgrade an explicit analysis request when global consent is absent", async () => {
    const { service, rpc } = setup("disabled", { privacy_preferences: { journal_ai_analysis_enabled: false } });
    await expect(service.create(userId, input, "idempotency-test-key")).rejects.toMatchObject({
      code: "ANALYSIS_GATE_FAILED",
      details: { journalSaved: false },
    });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["reserve_rejected_submission"]);
  });
  it("rejects fixture headers in production, in disabled mode, and for unapproved users", async () => {
    for (const [service, identity] of [
      [setup("development_stub", {}, true).service, userId],
      [setup("disabled").service, userId],
      [setup("development_stub").service, "other-user"],
    ] as const)
      await expect(service.create(identity, input, "idempotency-test-key", "slow_processing")).rejects.toMatchObject({
        statusCode: 403,
      });
  });
  it("replays a stored private response without rereading mutable journal content", async () => {
    const base = setup();
    const identity = base.keys.identify("idempotency-test-key", { ...input, analysisConsent: false, fixture: null });
    const { service, rpc } = setup("disabled", {
      idempotency_records: [
        {
          key_version: identity.keyVersion,
          key_hmac: identity.keyHmac,
          request_hash: identity.requestHash,
          state: "succeeded",
          response_status: 201,
          response_payload: { journalId: "original-id" },
        },
      ],
    });
    expect(await service.create(userId, { ...input, analysisConsent: false }, "idempotency-test-key")).toEqual({
      kind: "private",
      journalId: "original-id",
      replayed: true,
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
