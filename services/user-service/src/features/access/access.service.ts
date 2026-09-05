import type { OwnedDatabase } from "@echo/service-core";
import { ExternalServiceError, ValidationError } from "../../shared/errors/app-error.js";
import { ELIGIBILITY_RULE_VERSION } from "../registration/registration.service.js";

export type AccessDecision =
  | "ACCOUNT_UNAVAILABLE"
  | "AGE_VERIFICATION_REQUIRED"
  | "POLICY_REVIEW_REQUIRED"
  | "ONBOARDING_REQUIRED"
  | "ACCESS_GRANTED";

type Row = Record<string, unknown>;

function ageOnDate(value: string, now = new Date()): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ValidationError({ birthday: ["Enter a valid birthday."] });
  const birth = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime()) || birth.toISOString().slice(0, 10) !== value) {
    throw new ValidationError({ birthday: ["Enter a valid birthday."] });
  }
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const month = now.getUTCMonth() - birth.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

export class AccessService {
  constructor(private readonly database: OwnedDatabase) {}

  async decide(userId: string): Promise<{ decision: AccessDecision; onboardingStep: number }> {
    const { data: profile, error } = await this.database
      .from("profiles")
      .select("account_status,eligible_18_plus,eligibility_verified_at,onboarding_completed,onboarding_step")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Account access could not be checked.");
    const row = profile as Row | null;
    const step = Number(row?.onboarding_step ?? 0);
    if (!row || row.account_status !== "active") return { decision: "ACCOUNT_UNAVAILABLE", onboardingStep: 0 };
    if (row.eligible_18_plus !== true || !row.eligibility_verified_at) {
      return { decision: "AGE_VERIFICATION_REQUIRED", onboardingStep: step };
    }

    const [{ data: active, error: policyError }, { data: consents, error: consentError }] = await Promise.all([
      this.database.from("registration_policy_documents").select("document_type,version").eq("is_active", true),
      this.database.from("user_consents").select("consent_type,consent_version,accepted").eq("user_id", userId).eq("accepted", true).is("revoked_at", null),
    ]);
    if (policyError || consentError || !active || active.length !== 3) {
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Account policy access could not be checked.");
    }
    const accepted = new Set((consents ?? []).map((item: Row) => `${item.consent_type}:${item.consent_version}`));
    const consentType = (documentType: unknown) => documentType === "privacy_notice"
      ? "privacy_policy"
      : documentType === "ai_analysis_notice"
        ? "ai_feature_notice"
        : String(documentType);
    if ((active as Row[]).some((item) => !accepted.has(`${consentType(item.document_type)}:${item.version}`))) {
      return { decision: "POLICY_REVIEW_REQUIRED", onboardingStep: step };
    }
    if (!row.onboarding_completed) return { decision: "ONBOARDING_REQUIRED", onboardingStep: step };
    return { decision: "ACCESS_GRANTED", onboardingStep: 3 };
  }

  async verifyLegacyAge(userId: string, birthday: string): Promise<void> {
    const now = new Date();
    const age = ageOnDate(birthday, now);
    if (age < 18) throw new ValidationError({ birthday: ["ECHO accounts are available only to people aged 18 or older."] });
    if (age > 120) throw new ValidationError({ birthday: ["Check the birthday and try again."] });
    const { error } = await this.database.from("profiles").update({
      eligible_18_plus: true,
      eligibility_verified_at: now.toISOString(),
      eligibility_rule_version: ELIGIBILITY_RULE_VERSION,
      eligibility_source: "legacy_age_gate",
    }).eq("id", userId);
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Age eligibility could not be saved.");
  }

  async acceptCurrentPolicies(userId: string, reviewedDocumentIds: string[]): Promise<void> {
    const { data: active, error } = await this.database
      .from("registration_policy_documents")
      .select("id,document_type,version")
      .eq("is_active", true);
    if (error || !active || active.length !== 3) {
      throw new ExternalServiceError("POLICIES_UNAVAILABLE", "Current policies are unavailable.");
    }
    if (new Set(reviewedDocumentIds).size !== 3 || (active as Row[]).some((item) => !reviewedDocumentIds.includes(String(item.id)))) {
      throw new ValidationError({ reviewedDocumentIds: ["The policies changed. Reload and review the current documents before accepting."] });
    }
    const acceptedAt = new Date().toISOString();
    const rows = (active as Row[]).map((item) => ({
      user_id: userId,
      consent_type: item.document_type === "privacy_notice"
        ? "privacy_policy"
        : item.document_type === "ai_analysis_notice"
          ? "ai_feature_notice"
          : item.document_type,
      consent_version: item.version,
      accepted: true,
      accepted_at: acceptedAt,
      revoked_at: null,
      source: "policy_update",
    }));
    const result = await this.database.from("user_consents").upsert(rows, { onConflict: "user_id,consent_type,consent_version" });
    if (result.error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Policy acknowledgements could not be saved.");
  }
}
