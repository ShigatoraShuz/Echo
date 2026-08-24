import type { SupabaseClient } from "@supabase/supabase-js";
import { ExternalServiceError } from "../../shared/errors/app-error.js";

export interface OnboardingConsentInput {
  terms: boolean;
  privacy: boolean;
  dataProcessing: boolean;
  aiInformation: boolean;
  journalAnalysis: boolean;
}

export interface OnboardingProfileInput {
  displayName: string;
  timezone: string;
  goals?: string;
  buddyTone?: string;
  startingMood?: string;
}

export interface OnboardingSetupInput {
  theme?: "light" | "dark" | "system";
  notifications?: boolean;
  facialAnalysis?: boolean;
}

const CONSENT_VERSION = "2026-07-25";

export class OnboardingService {
  constructor(private readonly database: SupabaseClient) {}

  private async ensureDefaults(userId: string): Promise<void> {
    const [profile, notifications, privacy] = await Promise.all([
      this.database.from("user_service.profiles").upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true }),
      this.database.from("user_service.notification_preferences").upsert(
        { user_id: userId },
        { onConflict: "user_id", ignoreDuplicates: true },
      ),
      this.database.from("user_service.privacy_preferences").upsert(
        { user_id: userId },
        { onConflict: "user_id", ignoreDuplicates: true },
      ),
    ]);
    if (profile.error || notifications.error || privacy.error) {
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Onboarding setup could not be prepared.");
    }
  }

  async saveConsent(userId: string, input: OnboardingConsentInput) {
    await this.ensureDefaults(userId);
    const recordedAt = new Date().toISOString();

    const consentEntries = [
      {
        user_id: userId,
        consent_type: "terms_of_use",
        consent_version: CONSENT_VERSION,
        accepted: Boolean(input.terms),
        accepted_at: input.terms ? recordedAt : null,
        source: "onboarding",
      },
      {
        user_id: userId,
        consent_type: "privacy_policy",
        consent_version: CONSENT_VERSION,
        accepted: Boolean(input.privacy),
        accepted_at: input.privacy ? recordedAt : null,
        source: "onboarding",
      },
      {
        user_id: userId,
        consent_type: "data_processing_notice",
        consent_version: CONSENT_VERSION,
        accepted: Boolean(input.dataProcessing),
        accepted_at: input.dataProcessing ? recordedAt : null,
        source: "onboarding",
      },
      {
        user_id: userId,
        consent_type: "ai_feature_notice",
        consent_version: CONSENT_VERSION,
        accepted: Boolean(input.aiInformation),
        accepted_at: input.aiInformation ? recordedAt : null,
        source: "onboarding",
      },
      {
        user_id: userId,
        consent_type: "journal_analysis",
        consent_version: CONSENT_VERSION,
        accepted: Boolean(input.journalAnalysis),
        accepted_at: input.journalAnalysis ? recordedAt : null,
        source: "onboarding",
      },
    ];

    for (const item of consentEntries) {
      const { error } = await this.database
        .from("user_service.user_consents")
        .upsert(item, { onConflict: "user_id,consent_type,consent_version" });
      if (error) {
        throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Consent preferences could not be recorded.");
      }
    }

    return { success: true };
  }

  async saveProfile(userId: string, input: OnboardingProfileInput) {
    await this.ensureDefaults(userId);
    const updates: Record<string, unknown> = {};
    if (input.displayName !== undefined) updates.display_name = input.displayName;
    if (input.timezone !== undefined) updates.timezone = input.timezone;

    if (Object.keys(updates).length > 0) {
      const { error } = await this.database.from("user_service.profiles").update(updates).eq("id", userId);
      if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Profile could not be saved.");
    }

    return { success: true };
  }

  async saveSetup(userId: string, input: OnboardingSetupInput) {
    await this.ensureDefaults(userId);

    if (input.notifications !== undefined) {
      const { error } = await this.database
        .from("user_service.notification_preferences")
        .update({ in_app_enabled: input.notifications, push_enabled: input.notifications })
        .eq("user_id", userId);
      if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Notification setup could not be saved.");
    }

    if (input.facialAnalysis !== undefined) {
      const { error } = await this.database
        .from("user_service.privacy_preferences")
        .update({ facial_analysis_enabled: input.facialAnalysis })
        .eq("user_id", userId);
      if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Privacy setup could not be saved.");
    }

    return { success: true };
  }

  async completeOnboarding(userId: string) {
    await this.ensureDefaults(userId);
    const { error } = await this.database
      .from("user_service.profiles")
      .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Could not complete onboarding.");
    return { success: true };
  }

  async getStatus(userId: string) {
    await this.ensureDefaults(userId);
    const [profileResult, consentsResult] = await Promise.all([
      this.database.from("user_service.profiles").select("onboarding_completed, display_name, timezone").eq("id", userId).single(),
      this.database.from("user_service.user_consents").select("consent_type, accepted, accepted_at").eq("user_id", userId),
    ]);

    const profile = profileResult.data as Record<string, unknown> | null;
    const consents = (consentsResult.data ?? []) as Array<{ consent_type: string; accepted: boolean }>;

    return {
      onboardingCompleted: Boolean(profile?.onboarding_completed),
      displayName: typeof profile?.display_name === "string" ? profile.display_name : "",
      timezone: typeof profile?.timezone === "string" ? profile.timezone : "UTC",
      consents: Object.fromEntries(consents.map((c) => [c.consent_type, c.accepted])),
    };
  }
}
