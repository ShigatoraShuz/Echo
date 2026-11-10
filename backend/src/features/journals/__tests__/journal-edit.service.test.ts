import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { JournalService } from "../journals.service.js";
import { createEncryptionService } from "../../../infrastructure/encryption/encryption.service.js";
import { createDisabledAnalysisProvider } from "../../../infrastructure/analysis/mock-analysis.provider.js";

function setup(error: {message:string;code?:string} | null = null) {
  const current = { id:"journal", title:"Original", body:"Original body", emotions:[], tags:[], privacy_status:"private", analysis_consent:false, created_at:"2026-11-10T00:00:00Z", updated_at:"2026-11-10T00:00:00Z" };
  const rpc = vi.fn(async (_name:string, args:Record<string,unknown>) => ({ error, data: error ? null : { entry: { id:"journal", user_id:"owner", title:"[encrypted]", ...(args.p_entry as object), analysis_consent:false, created_at:current.created_at, updated_at:"2026-11-10T00:01:00Z" }, jobId:null, status:"saved" } }));
  const database = {schema:()=>({rpc})} as unknown as SupabaseClient;
  const service = new JournalService(database,createEncryptionService(Buffer.alloc(32,4).toString("base64"),1),createDisabledAnalysisProvider());
  vi.spyOn(service,"get").mockResolvedValue(current as never);
  return {service,rpc,current};
}
describe("atomic journal editing",()=>{
  it("sends encrypted text and the expected revision to the owner-scoped RPC, with no old result",async()=>{
    const {service,rpc,current}=setup();
    const updated=await service.update("owner","journal",{body:"Corrected body",expectedUpdatedAt:current.updated_at});
    expect(rpc).toHaveBeenCalledWith("edit_journal",expect.objectContaining({p_user_id:"owner",p_journal_id:"journal",p_expected_updated_at:current.updated_at,p_analysis_requested:false}));
    expect(JSON.stringify(rpc.mock.calls[0][1])).not.toContain("Corrected body");
    expect(updated.body).toBe("Corrected body"); expect(updated.risk_score).toBeNull();
    expect(updated.summary).toBe("No analysis result is available.");
  });
  it("rejects a stale client revision without writing",async()=>{
    const {service,rpc}=setup();
    await expect(service.update("owner","journal",{body:"Edit",expectedUpdatedAt:"2026-11-09T00:00:00Z"})).rejects.toMatchObject({code:"JOURNAL_EDIT_CONFLICT"});
    expect(rpc).not.toHaveBeenCalled();
  });
  it("handles concurrent database conflicts without a separate fallback write",async()=>{
    const {service,rpc}=setup({message:"JOURNAL_EDIT_CONFLICT"});
    await expect(service.update("owner","journal",{body:"Edit"})).rejects.toMatchObject({code:"JOURNAL_EDIT_CONFLICT"});
    expect(rpc).toHaveBeenCalledOnce();
  });
  it("does not invalidate or requeue an unchanged entry",async()=>{
    const {service,rpc,current}=setup();
    expect(await service.update("owner","journal",{title:current.title,body:current.body})).toEqual(current);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("face revision migration compatibility",()=>{
  function faceSetup() {
    const fixture=setup();
    vi.spyOn(fixture.service,"evaluateFace").mockResolvedValue({schemaVersion:"echo-face-expression-v1",status:"unavailable",reason:"no_face"} as never);
    Object.defineProperty(fixture.service,"assertAnalysisGates",{value:async()=>{}});
    return fixture;
  }
  it("keeps legacy face saves working only when neither new RPC exists",async()=>{
    const {service,rpc}=faceSetup();
    rpc.mockResolvedValueOnce({error:{code:"PGRST202",message:"missing face RPC"},data:null})
      .mockResolvedValueOnce({error:{code:"PGRST202",message:"missing edit RPC"},data:null})
      .mockResolvedValueOnce({error:null,data:null});
    await service.submitFace("owner","journal",Buffer.from("synthetic"));
    expect(rpc.mock.calls.map(call=>call[0])).toEqual(["save_journal_face_result_for_revision","edit_journal","save_journal_face_result"]);
  });
  it("does not bypass a deployed edit fence if the new face RPC is unavailable",async()=>{
    const {service,rpc}=faceSetup();
    rpc.mockResolvedValueOnce({error:{code:"PGRST202",message:"missing face RPC"},data:null})
      .mockResolvedValueOnce({error:{code:"P0001",message:"JOURNAL_NOT_FOUND"},data:null});
    await expect(service.submitFace("owner","journal",Buffer.from("synthetic"))).rejects.toMatchObject({code:"FACE_SAVE_FAILED"});
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it("does not fall back after an access or revision error",async()=>{
    const {service,rpc}=faceSetup();
    rpc.mockResolvedValueOnce({error:{code:"42501",message:"not allowed"},data:null});
    await expect(service.submitFace("owner","journal",Buffer.from("synthetic"))).rejects.toMatchObject({code:"FACE_SAVE_FAILED"});
    expect(rpc).toHaveBeenCalledOnce();
  });
});


it("reads only the active revision when archived analysis requests exist", async () => {
  const filters: Record<string, unknown> = {};
  const query = {
    select: () => query,
    eq: (name: string, value: unknown) => { filters[name] = value; return query; },
    is: (name: string, value: unknown) => { filters[name] = value; return query; },
    maybeSingle: async () => Object.hasOwn(filters, "deleted_at")
      ? { data: null, error: null }
      : { data: null, error: { message: "Archived and current requests are multiple rows" } },
  };
  const service = new JournalService({ schema: () => ({ from: () => query }) } as unknown as SupabaseClient,
    createEncryptionService(Buffer.alloc(32,4).toString("base64"),1), createDisabledAnalysisProvider());
  vi.spyOn(service, "get").mockResolvedValue({} as never);
  expect(await service.getLatestAnalysis("owner", "journal")).toBeNull();
  expect(filters).toEqual({ user_id: "owner", journal_id: "journal", deleted_at: null });
});
