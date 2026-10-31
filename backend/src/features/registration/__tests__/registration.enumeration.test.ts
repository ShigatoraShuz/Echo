import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { RegistrationService } from "../registration.service.js";
function harness(error:unknown) {
 const secret="synthetic-test-secret";
 const rpc=vi.fn(async(name:string)=>name==="echo_registration_get_draft" ? {data:{id:"draft",state:"account",csrf_hash:createHmac("sha256",secret).update("csrf").digest("hex")},error:null}:{data:true,error:null});
 const signUp=vi.fn().mockResolvedValue({data:{user:{id:"new-user"}},error});
 const factory=vi.fn(()=>({auth:{signUp}}));
 const service=new RegistrationService({rpc} as never,factory as never,secret,"https://echo.example");
 return {service,signUp,factory,rpc};
}
describe("registration enumeration boundary",()=>{
 it("passes the chosen password and confirmation redirect to Supabase",async()=>{
 const h=harness(null);
 await h.service.registerEmail("token","csrf","  New@Example.Test  ","StrongPass1");
 expect(h.signUp).toHaveBeenCalledWith({
   email:"new@example.test",password:"StrongPass1",
   options:{data:{signup_reservation:expect.any(String)},emailRedirectTo:"https://echo.example/callback?next=/onboarding"},
 });
 });
 it("does not claim an account was created if Auth returns no user",async()=>{
 const h=harness(null);
 h.signUp.mockResolvedValueOnce({data:{user:null},error:null});
 await expect(h.service.registerEmail("token","csrf","synthetic@example.test","StrongPass1")).rejects.toMatchObject({code:"EMAIL_SIGNUP_FAILED"});
 });
 it("completes password-only signup when Auth creates an immediate session",async()=>{
 const h=harness(null);
 h.signUp.mockResolvedValueOnce({data:{user:{id:"new-user"},session:{access_token:"synthetic-session"}},error:null});
 await expect(h.service.registerEmail("token","csrf","synthetic@example.test","StrongPass1")).resolves.toBeNull();
 expect(h.rpc).toHaveBeenCalledTimes(2);
 });
 it.each([{code:"user_already_exists",message:"private account detail"},{code:"email_exists",message:"private account detail"}])("does not reveal an existing address",async(error)=>{
 const h=harness(error);
 await expect(h.service.registerEmail("token","csrf","synthetic@example.test","StrongPass1")).resolves.toBeNull();
 expect(h.factory).toHaveBeenCalledOnce();
 });
 it("never returns unexpected provider diagnostics",async()=>{
 const h=harness({code:"unexpected_failure",message:"private database details"});
 await expect(h.service.registerEmail("token","csrf","synthetic@example.test","StrongPass1")).rejects.toMatchObject({code:"EMAIL_SIGNUP_FAILED",message:"Registration is temporarily unavailable. Please try again later."});
 expect(h.rpc).toHaveBeenLastCalledWith("echo_registration_update_draft", expect.objectContaining({
   expected_state: "verification_pending",
   changes: { state: "account", email: null, reservation_id: null, verification_sent_at: null },
 }));
 });
 it("restores the draft and gives a retry instruction after the hosted email limit",async()=>{
  const h=harness({code:"over_email_send_rate_limit",status:429,message:"private provider diagnostics"});
  await expect(h.service.registerEmail("token","csrf","synthetic@example.test","StrongPass1")).rejects.toMatchObject({
    code:"EMAIL_SIGNUP_RATE_LIMITED",statusCode:429,
    message:"Too many signup requests. Please wait before trying again.",
  });
  expect(h.rpc).toHaveBeenLastCalledWith("echo_registration_update_draft", expect.objectContaining({
    expected_state:"verification_pending",changes: { state:"account",email:null,reservation_id:null,verification_sent_at:null },
  }));
 });
 it("identifies unavailable email delivery without exposing the address or provider message",async()=>{
  const h=harness({code:"email_address_not_authorized",status:422,message:"private recipient detail"});
  await expect(h.service.registerEmail("token","csrf","synthetic@example.test","StrongPass1")).rejects.toMatchObject({
    code:"EMAIL_DELIVERY_NOT_CONFIGURED",statusCode:503,
    message:"Email registration is unavailable until email delivery is configured.",
  });
  expect(h.rpc).toHaveBeenLastCalledWith("echo_registration_update_draft", expect.objectContaining({
    expected_state:"verification_pending",changes:{state:"account",email:null,reservation_id:null,verification_sent_at:null},
  }));
 });
 it("restores the draft when the provider request throws",async()=>{
  const h=harness(null);
  h.signUp.mockRejectedValueOnce(new Error("private transport detail"));
  await expect(h.service.registerEmail("token","csrf","synthetic@example.test","StrongPass1")).rejects.toMatchObject({
    code:"EMAIL_SIGNUP_FAILED",statusCode:503,
  });
  expect(h.rpc).toHaveBeenLastCalledWith("echo_registration_update_draft", expect.objectContaining({
    expected_state:"verification_pending",changes: { state:"account",email:null,reservation_id:null,verification_sent_at:null },
  }));
 });
 it("does not silently retry when provider delivery is uncertain and the draft cannot be restored",async()=>{
  const h=harness({code:"email_send_failed",status:503});
  h.rpc.mockImplementation(async(name:string, options?: {expected_state?:string})=>
    name==="echo_registration_get_draft"
      ? {data:{id:"draft",state:"account",csrf_hash:createHmac("sha256","synthetic-test-secret").update("csrf").digest("hex")},error:null}
      : {data:options?.expected_state!=="verification_pending",error:null});
  await expect(h.service.registerEmail("token","csrf","synthetic@example.test","StrongPass1")).rejects.toMatchObject({
    code:"EMAIL_SIGNUP_UNCERTAIN",statusCode:503,
  });
 });
});
