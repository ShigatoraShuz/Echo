import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedUser } from "../../shared/types/authenticated-user.js";
import { ExternalServiceError } from "../../shared/errors/app-error.js";
import { ValidationError } from "../../shared/errors/app-error.js";
import { ELIGIBILITY_RULE_VERSION } from "../registration/registration.service.js";

export type AccessDecision =
  | "ACCOUNT_UNAVAILABLE"
  | "EMAIL_VERIFICATION_REQUIRED"
  | "AGE_VERIFICATION_REQUIRED"
  | "POLICY_REVIEW_REQUIRED"
  | "ONBOARDING_REQUIRED"
  | "ACCESS_GRANTED";

export class AccessService {
  constructor(private readonly database: SupabaseClient) {}
  async decide(user: AuthenticatedUser): Promise<{ decision: AccessDecision; onboardingStep: number }> {
    if (!user.emailVerified) return { decision: "EMAIL_VERIFICATION_REQUIRED", onboardingStep: 0 };
    const { data: profile, error } = await this.database
      .schema("user_service")
      .from("profiles")
      .select("account_status,eligible_18_plus,eligibility_verified_at,onboarding_completed,onboarding_step")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Account access could not be checked.");
    if (!profile || profile.account_status !== "active") return { decision: "ACCOUNT_UNAVAILABLE", onboardingStep: 0 };
    if (profile.eligible_18_plus !== true || !profile.eligibility_verified_at)
      return { decision: "AGE_VERIFICATION_REQUIRED", onboardingStep: Number(profile.onboarding_step ?? 0) };
    const { data: active } = await this.database
      .schema("auth_provisioning")
      .from("policy_documents")
      .select("document_type,version")
      .eq("is_active", true);
    const { data: consents } = await this.database
      .schema("user_service")
      .from("user_consents")
      .select("consent_type,consent_version,accepted")
      .eq("user_id", user.id)
      .eq("accepted", true);
    const accepted = new Set((consents ?? []).map((item) => `${item.consent_type}:${item.consent_version}`));
    if (
      !active ||
      active.length !== 3 ||
      active.some((item) => !accepted.has(`${item.document_type}:${item.version}`))
    ) {
      return { decision: "POLICY_REVIEW_REQUIRED", onboardingStep: Number(profile.onboarding_step ?? 0) };
    }
    if (!profile.onboarding_completed)
      return { decision: "ONBOARDING_REQUIRED", onboardingStep: Number(profile.onboarding_step ?? 0) };
    return { decision: "ACCESS_GRANTED", onboardingStep: 3 };
  }
  async verifyLegacyAge(userId: string, birthday: string): Promise<void> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) throw new ValidationError({ birthday: ["Enter a valid birthday."] });
    const birth = new Date(`${birthday}T00:00:00.000Z`);
    const now = new Date();
    if (Number.isNaN(birth.getTime()) || birth.toISOString().slice(0, 10) !== birthday)
      throw new ValidationError({ birthday: ["Enter a valid birthday."] });
    let age = now.getUTCFullYear() - birth.getUTCFullYear();
    const month = now.getUTCMonth() - birth.getUTCMonth();
    if (month < 0 || (month === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
    if (age < 18)
      throw new ValidationError({ birthday: ["ECHO accounts are available only to people aged 18 or older."] });
    const { error } = await this.database
      .schema("user_service")
      .from("profiles")
      .update({
        eligible_18_plus: true,
        eligibility_verified_at: now.toISOString(),
        eligibility_rule_version: ELIGIBILITY_RULE_VERSION,
        eligibility_source: "legacy_age_gate",
      })
      .eq("user_id", userId);
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Age eligibility could not be saved.");
  }
  async acceptCurrentPolicies(userId: string, reviewedDocumentIds: string[]): Promise<void> {
    const { data: active, error } = await this.database
      .schema("auth_provisioning")
      .from("policy_documents")
      .select("id,document_type,version")
      .eq("is_active", true);
    if (error || !active || active.length !== 3)
      throw new ExternalServiceError("POLICIES_UNAVAILABLE", "Current policies are unavailable.");
    if (new Set(reviewedDocumentIds).size !== 3 || active.some((policy) => !reviewedDocumentIds.includes(policy.id)))
      throw new ValidationError({
        reviewedDocumentIds: ["The policies changed. Reload and review the current documents before accepting."],
      });
    const recordedAt = new Date().toISOString();
    const rows = active.map((policy) => ({
      user_id: userId,
      consent_type: policy.document_type,
      consent_version: policy.version,
      accepted: true,
      accepted_at: recordedAt,
      source: "policy_update",
    }));
    const result = await this.database
      .schema("user_service")
      .from("user_consents")
      .upsert(rows, { onConflict: "user_id,consent_type,consent_version" });
    if (result.error)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Policy acknowledgements could not be saved.");
  }
}
