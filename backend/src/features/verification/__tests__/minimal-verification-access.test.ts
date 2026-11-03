import { expect, it, vi } from "vitest";
import { VerificationService } from "../verification.service.js";
function fixture() {
  const state={row: {id:"fictional",verification_status:"approved",approved_expires_at:"2099-01-01"} as Record<string,unknown>|null,contact:true};
  const chain={select:vi.fn(),eq:vi.fn(),update:vi.fn(),maybeSingle:vi.fn(async()=>({data:state.row,error:null})),single:vi.fn(async()=>({data:state.row,error:null}))};
  chain.select.mockReturnValue(chain);chain.eq.mockReturnValue(chain);chain.update.mockImplementation((patch)=>{Object.assign(state.row!,patch);return chain});
  const from=vi.fn((name:string)=>{if(name!=="identity_verifications")throw Error("Unexpected identity/document read");return chain});
  const rpc=vi.fn(async()=>({data:state.contact,error:null}));
  const database={schema:()=>({from,rpc})};
  return {state,chain,from,rpc,service:new VerificationService(database as never,{} as never)};
}
it("checks current approval and contact permission without loading/decrypting identity documents",async()=>{
  const {service,state,rpc,from}=fixture();
  expect(await service.getAiAccessStatus("owner-a")).toEqual({canAccessAi:true,accessRequirement:null});
  state.contact=false;
  expect(await service.getAiAccessStatus("owner-a")).toEqual({canAccessAi:false,accessRequirement:"trusted_contact"});
  expect(rpc).toHaveBeenCalledTimes(2);expect(rpc).toHaveBeenCalledWith("has_valid_trusted_contact",{p_user_id:"owner-a"});
  expect(from.mock.calls.every(([name])=>name==="identity_verifications")).toBe(true);
});
it("honors expiry and denies missing or unapproved applications without reading private preferences",async()=>{
  const {service,state,chain,rpc}=fixture();state.row!.approved_expires_at="2000-01-01";
  expect(await service.getAiAccessStatus("owner-a")).toEqual({canAccessAi:false,accessRequirement:"verification"});
  expect(chain.update).toHaveBeenCalledWith({verification_status:"expired"});expect(rpc).not.toHaveBeenCalled();
  state.row=null;expect((await service.getAiAccessStatus("owner-a")).canAccessAi).toBe(false);
});
