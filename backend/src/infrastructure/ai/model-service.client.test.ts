import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { modelPipelineResultSchema, phq8EstimateSchema } from "@echo/contracts";
import { ModelServiceClient } from "./model-service.client.js";
import { createEncryptionService } from "../encryption/encryption.service.js";
import { sealAnalysisResult, openAnalysisResult } from "../encryption/analysis-result-encryption.js";
import { LocalWorkerService } from "../../features/analysis/local-worker.service.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../../packages/contracts/fixtures/model-pipeline-v2.synthetic.json", import.meta.url),
    "utf8",
  ),
);
const secret = "internal-model-secret-never-sent-to-browser";
const client = () => new ModelServiceClient("http://127.0.0.1:8100", secret, new Set(["owner"]), 1000, "synthetic");
afterEach(() => vi.unstubAllGlobals());
describe("internal staged model boundary", () => {
  it("refuses raw research results outside explicit consultation mode and rechecks the allowed actor", async () => {
    const research = structuredClone(fixture);
    research.isSimulated = false; research.overallStatus = "partial";
    Object.values(research.stages).forEach((stage: unknown) => Object.assign(stage as object, { executionMode: "real", status: "unavailable", result: null, errorCode: "MODEL_NOT_ENABLED" }));
    research.researchDiagnostic = { executionState: "REAL_PROVISIONAL_MODEL", modelId: "echo-xlmr-v2-distress-raw", modelVersion: "provisional-20261030-format-v1",
      labels: ["Others", "Anxious", "Depressed", "Frustrated", "Suicidal"], rawLogits: [5, -2, -1, 0, -3], inputTokens: 12, windows: 1,
      calibrationApplied: false, preprocessingVerified: false, classificationSemanticsVerified: false, trainingReferenceParityVerified: false,
      clinicalUseAllowed: false, repeatConsistent: true, validationAndLoadMs: 10, forwardMs: [5, 4] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(research))));
    await expect(new ModelServiceClient("http://127.0.0.1:8100", secret, new Set(["owner"]), 1000, "real").analyze("owner", "fictional")).rejects.toMatchObject({ statusCode: 403 });
    const verify = vi.fn(async () => {});
    const explicit = new ModelServiceClient("http://127.0.0.1:8100", secret, new Set(["owner"]), 1000, "real", undefined, verify, true);
    expect((await explicit.analyze("owner", "fictional")).researchDiagnostic?.clinicalUseAllowed).toBe(false);
    expect(verify).toHaveBeenCalledTimes(2);
    for (const invalid of [{ ...research.researchDiagnostic, calibrationApplied: true }, { ...research.researchDiagnostic, clinicalUseAllowed: true }])
      expect(modelPipelineResultSchema.safeParse({ ...research, researchDiagnostic: invalid }).success).toBe(false);
  });
  it("rejects disconnected model final callbacks before database access",async()=>{
    const rpc=vi.fn();
    const worker=new LocalWorkerService({schema:()=>({rpc})} as never,{} as never,secret);
    await expect(worker.finalResult("job","local-worker","lease","callback-long-key",fixture)).rejects.toMatchObject({statusCode:403});
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    "https://example.com",
    "http://localhost:8100",
    "http://127.0.0.1:8100/path",
    "http://user:secret@127.0.0.1:8100",
  ])("rejects nonfixed origins: %s", (origin) => {
    expect(() => new ModelServiceClient(origin, secret, new Set(["owner"]), 1000, "real")).toThrow();
  });
  it("blocks nonallowlisted users before sending text", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(client().analyze("other", "private text")).rejects.toMatchObject({ statusCode: 403 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("validates independent stage results and authenticates only the internal request", async () => {
    const fetcher = vi.fn(async () => Response.json(fixture));
    vi.stubGlobal("fetch", fetcher);
    const result = await client().analyze("owner", "Fictional fixture text");
    expect(result.stages.phq8.result?.total).toBeNull();
    expect(fetcher.mock.calls[0]).toMatchObject([
      "http://127.0.0.1:8100/engineering/v2/analyze",
      { redirect: "error", headers: { Authorization: `Bearer ${secret}` } },
    ]);
  });
  it("fails closed on model service failure and execution-mode mismatch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    await expect(client().analyze("owner", "fictional")).rejects.toMatchObject({ code: "MODEL_UNAVAILABLE" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(fixture)),
    );
    const real = new ModelServiceClient("http://127.0.0.1:8100", secret, new Set(["owner"]), 1000, "real");
    await expect(real.analyze("owner", "fictional")).rejects.toThrow("MODEL_EXECUTION_MODE_MISMATCH");
  });
  it("shares the CBT generation contract with Buddy and rejects unavailable stages", async () => {
    const fetcher = vi.fn(async () => Response.json(fixture.stages.cbt));
    vi.stubGlobal("fetch", fetcher);
    expect((await client().generate("owner", "fictional", [])).modelId).toBe(fixture.stages.cbt.modelId);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ...fixture.stages.cbt,
          status: "unavailable",
          result: null,
          errorCode: "BASE_WEIGHTS_MISSING",
        }),
      ),
    );
    await expect(client().generate("owner", "fictional", [])).rejects.toMatchObject({ code: "MODEL_UNAVAILABLE" });
  });
  it("rechecks generation access after inference so revoked verification cannot expose a reply", async () => {
    const verify = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("verification revoked"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(fixture.stages.cbt)),
    );
    const guarded = new ModelServiceClient(
      "http://127.0.0.1:8100",
      secret,
      new Set(["owner"]),
      1000,
      "synthetic",
      verify,
    );
    await expect(guarded.generate("owner", "fictional", [])).rejects.toThrow("verification revoked");
    expect(verify).toHaveBeenCalledTimes(2);
  });
  it("encrypts synthetic results without populating clinical score or severity indexes", () => {
    const encryption = createEncryptionService(Buffer.alloc(32, 17).toString("base64"), 1, {});
    const sealed = sealAnalysisResult(fixture, encryption);
    expect(sealed.supportSeverity).toBeNull();
    expect(sealed.isSimulated).toBe(true);
    expect(JSON.stringify(sealed)).not.toContain("fixture_emotion_a");
    expect(openAnalysisResult({ ciphertext: sealed.encryptedPayload }, encryption)).toEqual(fixture);
  });
  it("rejects false totals, unknown-to-zero coercion, mixed modes and invented distress labels", () => {
    const phq = fixture.stages.phq8.result;
    expect(phq8EstimateSchema.safeParse({ ...phq, total: 6 }).success).toBe(false);
    expect(phq8EstimateSchema.safeParse({ ...phq, items: { ...phq.items, sleep: 0 } }).success).toBe(false);
    const mixed = structuredClone(fixture);
    mixed.stages.peak.executionMode = "real";
    expect(modelPipelineResultSchema.safeParse(mixed).success).toBe(false);
    const bad = structuredClone(fixture);
    bad.stages.distress.result.scores.pop();
    expect(modelPipelineResultSchema.safeParse(bad).success).toBe(false);
  });
  it("refuses the retired engineering worker identity before any claim or decryption", async () => {
    const rpc = vi.fn(async () => ({ data: { userId: "other", journalId: "foreign" }, error: null }));
    const get = vi.fn();
    const worker = new LocalWorkerService(
      { schema: () => ({ rpc }) } as never,
      { get } as never,
      secret,
    );
    await expect(worker.claim("echo-http-engineering-v1")).rejects.toMatchObject({ statusCode: 403 });
    expect(rpc).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });
});
