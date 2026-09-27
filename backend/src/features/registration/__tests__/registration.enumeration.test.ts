import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { RegistrationService } from "../registration.service.js";
function harness(error:unknown) {
 const secret="synthetic-test-secret";
 const rpc=vi.fn(async(name:string)=>name==="echo_registration_get_draft" ? {data:{id:"draft",state:"account",csrf_hash:createHmac("sha256",secret).update("csrf").digest("hex")},error:null}:{data:true,error:null});
 const signUp=vi.fn().mockResolvedValue({error});
 const factory=vi.fn(()=>({auth:{signUp}}));
 const service=new RegistrationService({rpc} as never,factory as never,secret,"","https://echo.example");
 return {service,signUp,factory};
}
describe("registration enumeration boundary",()=>{
 it.each([null,{code:"user_already_exists",message:"private account detail"},{code:"email_exists",message:"private account detail"}])("returns identical credential shapes for existing and new addresses",async(error)=>{
 const h=harness(error);const result=await h.service.registerEmail("token","csrf","synthetic@example.test","StrongPass1");
 expect(Object.keys(result).sort()).toEqual(["csrf","token"]);expect(result.token).toHaveLength(43);expect(h.factory).toHaveBeenCalledOnce();
 });
 it("never returns unexpected provider diagnostics",async()=>{
 const h=harness({code:"unexpected_failure",message:"private database details"});
 await expect(h.service.registerEmail("token","csrf","synthetic@example.test","StrongPass1")).rejects.toMatchObject({code:"EMAIL_SIGNUP_FAILED",message:"Registration could not be completed. Please try again later."});
 });
});
