import { describe, expect, it, vi } from "vitest";
import { WellnessService, defaultWellnessSchedule } from "../../src/features/experience/wellness.service.js";
import {
  createEncryptionService,
  decryptText,
  encryptText,
} from "../../src/infrastructure/encryption/encryption.service.js";
const encryption = createEncryptionService(Buffer.alloc(32, 9).toString("base64"), 1);
const userId = "70000000-0000-4000-8000-000000000001";
const submissionId = "71000000-0000-4000-8000-000000000001";
const input = { submissionId, responses: [3, 3, 3, 3, 3, 3, 3, 3] };
function setup(stored?: string, owner = userId) {
  const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => ({
    data: {
      id: "assessment-id",
      user_id: owner,
      submission_id: submissionId,
      assessment_ciphertext: stored ?? args.p_ciphertext,
      completed_at: "2026-09-20T00:00:00Z",
    },
    error: null,
  }));
  return {
    rpc,
    service: new WellnessService({ schema: () => ({ rpc }) } as never, defaultWellnessSchedule, encryption),
  };
}
describe("encrypted wellness assessments", () => {
  it("computes the existing score on the server and passes only ciphertext to persistence", async () => {
    const h = setup();
    expect(await h.service.save(userId, input)).toEqual({
      id: "assessment-id",
      score: 24,
      severity: "severe",
      completedAt: "2026-09-20T00:00:00Z",
    });
    const [name, args] = h.rpc.mock.calls[0];
    expect(name).toBe("save_encrypted_phq8");
    expect(Object.keys(args).sort()).toEqual(["p_ciphertext", "p_interval_days", "p_submission_id", "p_user_id"]);
    expect(args.p_ciphertext).not.toContain("severe");
    expect(JSON.parse(decryptText(args.p_ciphertext, encryption))).toMatchObject({
      userId,
      submissionId,
      responses: input.responses,
      score: 24,
      severity: "severe",
    });
  });
  it("rejects malformed answers before calling persistence", async () => {
    const h = setup();
    await expect(h.service.save(userId, { submissionId, responses: [3, 3] })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it("accepts exact retries but rejects a changed answer set for the same submission", async () => {
    const stored = encryptText(
      JSON.stringify({ format: "echo-phq8-v1", userId, ...input, score: 24, severity: "severe" }),
      encryption,
    );
    const h = setup(stored);
    await expect(h.service.save(userId, input)).resolves.toMatchObject({ score: 24 });
    await expect(h.service.save(userId, { submissionId, responses: Array(8).fill(0) })).rejects.toMatchObject({
      statusCode: 409,
      code: "SUBMISSION_CONFLICT",
    });
  });
  it.each(["wrong-owner", "wrong-submission", "wrong-score", "tampered"])("rejects %s persisted data", async (kind) => {
    const payload = {
      format: "echo-phq8-v1",
      userId: kind === "wrong-owner" ? "other" : userId,
      ...input,
      submissionId: kind === "wrong-submission" ? "other" : submissionId,
      score: kind === "wrong-score" ? 0 : 24,
      severity: "severe",
    };
    const stored = kind === "tampered" ? "echo:encrypted:v1:invalid" : encryptText(JSON.stringify(payload), encryption);
    await expect(setup(stored).service.save(userId, input)).rejects.toMatchObject({ statusCode: 503 });
  });
});
