import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareReviewerMfa, verifyReviewerMfa } from "./reviewer-mfa";
const m = vi.hoisted(()=>({getAuthenticatorAssuranceLevel:vi.fn(),listFactors:vi.fn(),enroll:vi.fn(),unenroll:vi.fn(),challengeAndVerify:vi.fn()}));
vi.mock("@/infrastructure/supabase/browser-client",()=>({createBrowserSupabaseClient:()=>({auth:{mfa:m}})}));
beforeEach(()=>{
 m.getAuthenticatorAssuranceLevel.mockResolvedValue({data:{currentLevel:"aal1"},error:null});
 m.listFactors.mockResolvedValue({data:{totp:[],all:[]},error:null});
 m.enroll.mockResolvedValue({data:{id:"new",totp:{qr_code:"data:image/svg+xml;utf-8,<svg/>"}},error:null});
 m.unenroll.mockResolvedValue({error:null}); m.challengeAndVerify.mockResolvedValue({error:null});
});
describe("reviewer MFA",()=>{
 it("uses verified factors without changing enrollment",async()=>{
 m.listFactors.mockResolvedValue({data:{totp:[{id:"existing",status:"verified"}],all:[]},error:null});
 expect(await prepareReviewerMfa()).toEqual({id:"existing"});expect(m.enroll).not.toHaveBeenCalled();expect(m.unenroll).not.toHaveBeenCalled();
 });
 it("enrolls TOTP and removes only unfinished factors created by this flow",async()=>{
 m.listFactors.mockResolvedValue({data:{totp:[],all:[{id:"unfinished",status:"unverified",friendly_name:"ECHO reviewer"},{id:"keep",status:"verified",friendly_name:"ECHO reviewer"}]},error:null});
 expect(await prepareReviewerMfa()).toMatchObject({id:"new"});expect(m.unenroll).toHaveBeenCalledExactlyOnceWith({factorId:"unfinished"});
 });
 it("fails closed when assurance cannot be checked",async()=>{
 m.getAuthenticatorAssuranceLevel.mockResolvedValue({data:null,error:{message:"private"}});
 await expect(prepareReviewerMfa()).rejects.toThrow("MFA unavailable");expect(m.enroll).not.toHaveBeenCalled();
 });
 it("does not enroll again at aal2",async()=>{
 m.getAuthenticatorAssuranceLevel.mockResolvedValue({data:{currentLevel:"aal2"},error:null});
 expect(await prepareReviewerMfa()).toBeNull();expect(m.listFactors).not.toHaveBeenCalled();
 });
 it("validates codes and never exposes provider errors",async()=>{
 await expect(verifyReviewerMfa("factor","bad")).rejects.toThrow("Invalid code");expect(m.challengeAndVerify).not.toHaveBeenCalled();
 m.challengeAndVerify.mockResolvedValue({error:{message:"provider private details"}});
 await expect(verifyReviewerMfa("factor","123456")).rejects.toThrow("Invalid code");
 });
});
