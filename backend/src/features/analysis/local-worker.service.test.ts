import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LocalWorkerService, canonicalCallback } from "./local-worker.service.js";
import native from "../../../../packages/contracts/fixtures/core-v2.json";
import { createEncryptionService } from "../../infrastructure/encryption/encryption.service.js";
import { openAnalysisResult, sealAnalysisResult } from "../../infrastructure/encryption/analysis-result-encryption.js";
import type { JournalService } from "../journals/journals.service.js";

function serviceWith(error: { message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data: { status: "safety_checking", progress: 10 }, error });
  const database = { schema: () => ({ rpc }) } as unknown as SupabaseClient;
  const service = new LocalWorkerService(database, {} as JournalService, "a-dedicated-worker-secret-of-32-characters");
  return { service, rpc };
}
describe("external worker protocol", () => {
  it("authenticates credentials and binds the single configured worker identity", async () => {
    const { service, rpc } = serviceWith();
    expect(() => service.authenticate("wrong")).toThrow();
    expect(() => service.authenticate("a-dedicated-worker-secret-of-32-characters")).not.toThrow();
    await expect(service.claim("other-worker")).rejects.toThrow(/identity/);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("sends only a hashed lease and HMAC callback key to the transaction", async () => {
    const { service, rpc } = serviceWith();
    await service.progress("job-id", "local-worker", "raw-lease-token", "raw-callback-key-16", {
      status: "safety_checking",
    });
    const args = rpc.mock.calls[0][1];
    expect(args.p_key_hmac).toMatch(/^[a-f0-9]{64}$/);
    expect(args.p_lease_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(args)).not.toMatch(/raw-/);
  });
  it("requires a fresh callback key for lease heartbeats", async () => {
    const { service, rpc } = serviceWith();
    await expect(service.heartbeat("job", "local-worker", "lease")).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("maps an exact-key/different-payload database conflict to 409", async () => {
    const { service } = serviceWith({ message: "CALLBACK_IDEMPOTENCY_CONFLICT" });
    await expect(
      service.progress("job", "local-worker", "lease", "callback-key-long", { status: "safety_checking" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it("does not allow client progress percentages or skipping the safety callback", async () => {
    const { service, rpc } = serviceWith();
    await expect(
      service.progress("job", "local-worker", "lease", "callback-key-long", {
        status: "safety_checking",
        progress: 100,
      }),
    ).rejects.toThrow();
    await expect(
      service.progress("job", "local-worker", "lease", "callback-key-long", { status: "analyzing_emotions" }),
    ).rejects.toThrow();
    expect(rpc.mock.calls.every(([name]) => name === "lookup_worker_receipt")).toBe(true);
  });
  it("canonicalizes callback object ordering but not content", () => {
    expect(canonicalCallback({ b: 2, a: [1] })).toBe(canonicalCallback({ a: [1], b: 2 }));
    expect(canonicalCallback({ a: 1 })).not.toBe(canonicalCallback({ a: 2 }));
  });
});


describe("opt-in native encrypted callbacks", () => {
  it("keeps native callbacks denied unless the profile explicitly permits them", async () => {
    const { service, rpc } = serviceWith();
    await expect(service.finalResult("job", "local-worker", "lease", "callback-key-long", native)).rejects.toThrow("disconnected");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("passes only a sealed result to the lease/ownership transaction", async () => {
    const encryption = createEncryptionService(Buffer.alloc(32, 5).toString("base64"), 1);
    const rpc = vi.fn().mockImplementation(async name => ({ data: name === "lookup_worker_receipt" ? null : "result-id", error: null }));
    const journals = { encryptAnalysisResult: (value: unknown) => sealAnalysisResult(value, encryption) } as JournalService;
    const database = { schema: () => ({ rpc }) } as unknown as SupabaseClient;
    const service = new LocalWorkerService(database, journals, "synthetic-worker-secret-32-characters", "local-worker", true);
    const result = { ...native, isSimulated: false };
    await expect(service.finalResult("job", "local-worker", "lease", "callback-key-long", result)).resolves.toEqual({ resultId: "result-id", status: "completed" });
    const [name, args] = rpc.mock.calls[1];
    expect(name).toBe("complete_worker_callback");
    expect(args.p_result.encryptedPayload).toMatch(/^echo:encrypted:v1:/);
    expect(args.p_result).not.toHaveProperty("emotionDistribution");
    expect(openAnalysisResult({ ciphertext: args.p_result.encryptedPayload }, encryption)).toEqual(result);
    expect(args.p_lease_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(args.p_result.supportSeverity).toBeNull();
  });
});

it.each(["LEASE_REJECTED", "ANALYSIS_GATE_FAILED"])("native completion preserves transaction denial: %s", async reason => {
  const encryptAnalysisResult=vi.fn();
  const rpc=vi.fn().mockResolvedValue({data:null,error:{message:reason}});
  const service=new LocalWorkerService({schema:()=>({rpc})} as unknown as SupabaseClient,
    {encryptAnalysisResult} as unknown as JournalService,"synthetic-worker-secret-32-characters","local-worker",true);
  await expect(service.finalResult("job","local-worker","revoked-lease","callback-key-long",{...native,isSimulated:false})).rejects.toMatchObject({statusCode:reason==="LEASE_REJECTED"?403:409});
  expect(encryptAnalysisResult).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("replays an authorized native receipt without a second persistence call",async()=>{
  const encryptAnalysisResult=vi.fn();
  const rpc=vi.fn().mockResolvedValue({data:{replay:true,outcome:{resultId:"prior-id",status:"completed"}},error:null});
  const service=new LocalWorkerService({schema:()=>({rpc})} as unknown as SupabaseClient,
    {encryptAnalysisResult} as unknown as JournalService,"synthetic-worker-secret-32-characters","local-worker",true);
  await expect(service.finalResult("job","local-worker","lease","callback-key-long",{...native,isSimulated:false})).resolves.toEqual({resultId:"prior-id",status:"completed"});
  expect(encryptAnalysisResult).not.toHaveBeenCalled();expect(rpc).toHaveBeenCalledTimes(1);
});

describe("hosted native worker scope", () => {
  it("never runs broad lease cleanup or scans shared queues", async () => {
    const rpc=vi.fn().mockResolvedValue({data:null,error:null});
    const database={schema:()=>({rpc})} as unknown as SupabaseClient;
    const scope={userIds:["e0000000-0000-4000-8000-000000000001"],createdAfter:"2026-11-01T00:00:00Z"};
    const service=new LocalWorkerService(database,{} as JournalService,"test-worker-token".repeat(3),"echo-native-development-v1",true,scope);
    expect(await service.releaseExpiredLeases()).toBe(0); expect(rpc).not.toHaveBeenCalled();
    await service.recover();
    expect(rpc).toHaveBeenCalledExactlyOnceWith("recover_native_jobs",{p_worker_id:"echo-native-development-v1",p_user_ids:scope.userIds,p_started_after:scope.createdAfter});
    rpc.mockClear();
    await expect(service.claim("local-worker")).rejects.toThrow(/identity/); expect(rpc).not.toHaveBeenCalled();
    await expect(service.claim("echo-native-development-v1")).resolves.toBeNull();
    expect(rpc).toHaveBeenCalledExactlyOnceWith("claim_native_job",expect.objectContaining({p_worker_id:"echo-native-development-v1",p_user_ids:scope.userIds,p_started_after:scope.createdAfter,p_lease_hash:expect.stringMatching(/^[a-f0-9]{64}$/)}));
  });
});
