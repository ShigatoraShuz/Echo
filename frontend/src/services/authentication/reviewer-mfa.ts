"use client";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
export interface ReviewerFactor { id: string; qrCode?: string }
export async function prepareReviewerMfa(): Promise<ReviewerFactor | null> {
 const mfa = createBrowserSupabaseClient().auth.mfa;
 const assurance = await mfa.getAuthenticatorAssuranceLevel();
 if (assurance.error) throw new Error("MFA unavailable");
 if (assurance.data.currentLevel === "aal2") return null;
 const factors = await mfa.listFactors();
 if (factors.error) throw new Error("MFA unavailable");
 const existing = factors.data.totp.find((factor) => factor.status === "verified");
 if (existing) return {id:existing.id};
 // Remove only unfinished factors created by this enrollment flow. Never remove verified factors.
 for (const factor of factors.data.all.filter((factor) => factor.status === "unverified" && factor.friendly_name === "ECHO reviewer")) {
   const removed = await mfa.unenroll({factorId:factor.id});
   if (removed.error) throw new Error("MFA unavailable");
 }
 const enrolled = await mfa.enroll({factorType:"totp",friendlyName:"ECHO reviewer"});
 if (enrolled.error || !enrolled.data.totp.qr_code.startsWith("data:image/svg+xml")) throw new Error("MFA unavailable");
 return {id:enrolled.data.id,qrCode:enrolled.data.totp.qr_code};
}
export async function verifyReviewerMfa(factorId:string, code:string): Promise<void> {
 if (!/^\d{6}$/.test(code)) throw new Error("Invalid code");
 const result = await createBrowserSupabaseClient().auth.mfa.challengeAndVerify({factorId,code});
 if (result.error) throw new Error("Invalid code");
}
