import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { summarizeSelfReportedPhq8 } from "@echo/contracts";
import { WellnessService } from "../wellness.service.js";
import { createEncryptionService, decryptText } from "../../../infrastructure/encryption/encryption.service.js";
import { encryptText } from "../../../infrastructure/encryption/encryption.service.js";
import { migrateAssessments } from "../../../infrastructure/encryption/wellness-migration.js";

const encryption = createEncryptionService(Buffer.alloc(32, 7).toString("base64"), 1);
describe("self-reported PHQ-8 encrypted snapshots", () => {
  it("keeps nullable self-reports readable by encryption rotation without inventing historical scores", async () => {
    const submissionId = randomUUID();
    const row = { id: randomUUID(), user_id: "owner", submission_id: submissionId,
      responses: null, score: null, severity: null,
      assessment_ciphertext: encryptText(JSON.stringify({ format: "echo-phq8-self-report-v2", userId: "owner", submissionId, responses: [1, ...Array(7).fill(null)] }), encryption) };
    const store = { page: vi.fn().mockResolvedValueOnce([row]).mockResolvedValueOnce([]), replace: vi.fn() };
    expect(await migrateAssessments(store, encryption, 1)).toMatchObject({ scanned: 1, unchanged: 1, unreadable: 0 });
    expect(store.replace).not.toHaveBeenCalled();
  });
  it("preserves unanswered and zero distinctly, with a total only for all eight responses", () => {
    expect(summarizeSelfReportedPhq8([2, 0, null, null, null, null, null, null])).toMatchObject({ scored_symptom_count: 2, subtotal: 2, total: null, complete: false });
    expect(summarizeSelfReportedPhq8(Array(8).fill(0))).toMatchObject({ scored_symptom_count: 8, subtotal: 0, total: 0, complete: true });
    expect(summarizeSelfReportedPhq8(Array(8).fill(null))).toMatchObject({ scored_symptom_count: 0, total: null });
    for (const invalid of [[], [4, ...Array(7).fill(null)], [false, ...Array(7).fill(null)]])
      expect(() => summarizeSelfReportedPhq8(invalid as never)).toThrow();
  });
  it("uses existing encrypted owner-scoped RPC and the unchanged weekly interval", async () => {
    const submissionId = randomUUID();
    const rpc = vi.fn(async (_: string, args: Record<string, unknown>) => {
      const payload = JSON.parse(decryptText(args.p_ciphertext, encryption));
      expect(payload).toMatchObject({ userId: "owner", submissionId, responses: [1, null, 0, null, null, null, null, null] });
      expect(args.p_interval_days).toBe(7);
      expect(args.p_ciphertext).not.toContain("responses");
      return { data: { id: randomUUID(), submission_id: submissionId, assessment_ciphertext: args.p_ciphertext, completed_at: new Date().toISOString() }, error: null };
    });
    const service = new WellnessService({ schema: () => ({ rpc }) } as never, undefined, encryption);
    const result = await service.saveSelfReport("owner", { submissionId, responses: [1, null, 0, null, null, null, null, null] });
    expect(result).toMatchObject({ executionState: "DEMO_FALLBACK", source: "SELF_REPORTED_PHQ8", scored_symptom_count: 2, total: null });
    expect(rpc).toHaveBeenCalledWith("save_encrypted_phq8", expect.objectContaining({ p_user_id: "owner" }));
  });
  it("rejects ciphertext rebound to a foreign owner", async () => {
    const rpc = vi.fn(async () => ({ data: { id: randomUUID(), submission_id: randomUUID(), assessment_ciphertext: "invalid" }, error: null }));
    const service = new WellnessService({ schema: () => ({ rpc }) } as never, undefined, encryption);
    await expect(service.saveSelfReport("foreign", { submissionId: randomUUID(), responses: Array(8).fill(null) })).rejects.toThrow();
  });
});
