import type { OwnedDatabase } from "@echo/service-core";
import { ExternalServiceError } from "../../shared/errors/app-error.js";

export interface OnboardingProfileInput {
  displayName: string;
  preferredName?: string;
  timezone: string;
  goals?: string[];
  buddyTone?: string;
  preferredCheckInTime?: string;
  startingMood?: string;
}

export interface OnboardingSetupInput {
  theme?: "light" | "dark" | "system";
  notifications?: boolean;
  genderIdentity?: string | null;
  genderSelfDescription?: string | null;
  pronouns?: string | null;
  pronounsSelfDescription?: string | null;
}

export class OnboardingService {
  constructor(private readonly database: OwnedDatabase) {}

  private async ensureDefaults(userId: string): Promise<void> {
    const [profile, notifications, privacy] = await Promise.all([
      this.database.from("profiles").upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true }),
      this.database.from("notification_preferences").upsert(
        { user_id: userId },
        { onConflict: "user_id", ignoreDuplicates: true },
      ),
      this.database.from("privacy_preferences").upsert(
        { user_id: userId },
        { onConflict: "user_id", ignoreDuplicates: true },
      ),
    ]);
    if (profile.error || notifications.error || privacy.error) {
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Onboarding setup could not be prepared.");
    }
  }

  async saveProfile(userId: string, input: OnboardingProfileInput) {
    await this.ensureDefaults(userId);
    const updates: Record<string, unknown> = {};
    if (input.displayName !== undefined) updates.display_name = input.displayName;
    if (input.preferredName !== undefined) updates.preferred_name = input.preferredName;
    if (input.timezone !== undefined) updates.timezone = input.timezone;
    if (input.goals !== undefined) updates.goals = input.goals;
    if (input.buddyTone !== undefined) updates.buddy_tone_preference = input.buddyTone;
    if (input.startingMood !== undefined) updates.starting_mood_preference = input.startingMood;
    updates.onboarding_step = 1;

    if (Object.keys(updates).length > 0) {
      const { error } = await this.database.from("profiles").update(updates).eq("id", userId);
      if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Profile could not be saved.");
    }

    if (input.preferredCheckInTime !== undefined) {
      const { error } = await this.database.from("notification_preferences").update({
        reminder_time: input.preferredCheckInTime,
        reminder_timezone: input.timezone,
      }).eq("user_id", userId);
      if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Check-in time could not be saved.");
    }

    return { success: true };
  }

  async saveSetup(userId: string, input: OnboardingSetupInput) {
    await this.ensureDefaults(userId);

    if (input.notifications !== undefined) {
      const { error } = await this.database
        .from("notification_preferences")
        .update({ in_app_enabled: input.notifications, push_enabled: input.notifications })
        .eq("user_id", userId);
      if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Notification setup could not be saved.");
    }

    const profileUpdates: Record<string, unknown> = { onboarding_step: 2 };
    if (input.theme !== undefined) profileUpdates.theme_mode = input.theme;
    if (input.genderIdentity !== undefined) profileUpdates.gender_identity = input.genderIdentity;
    if (input.genderSelfDescription !== undefined) profileUpdates.gender_self_description = input.genderSelfDescription;
    if (input.pronouns !== undefined) profileUpdates.pronouns = input.pronouns;
    if (input.pronounsSelfDescription !== undefined) profileUpdates.pronouns_self_description = input.pronounsSelfDescription;
    const { error: profileError } = await this.database.from("profiles").update(profileUpdates).eq("id", userId);
    if (profileError) {
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Profile preferences could not be saved.");
    }

    return { success: true };
  }

  async completeOnboarding(userId: string) {
    await this.ensureDefaults(userId);
    const { error } = await this.database
      .from("profiles")
      .update({ onboarding_completed: true, onboarding_step: 3, onboarding_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Could not complete onboarding.");
    return { success: true };
  }

  async getStatus(userId: string) {
    await this.ensureDefaults(userId);
    const [profileResult, consentsResult, notificationsResult] = await Promise.all([
      this.database
        .from("profiles")
        .select("onboarding_completed,onboarding_step,display_name,preferred_name,timezone,goals,buddy_tone_preference,starting_mood_preference,gender_identity,gender_self_description,pronouns,pronouns_self_description")
        .eq("id", userId)
        .single(),
      this.database.from("user_consents").select("consent_type, accepted, accepted_at").eq("user_id", userId),
      this.database.from("notification_preferences").select("reminder_time,reminder_timezone").eq("user_id", userId).single(),
    ]);

    if (profileResult.error || consentsResult.error || notificationsResult.error) {
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Onboarding preferences could not be retrieved.");
    }
    const profile = profileResult.data as Record<string, unknown> | null;
    const consents = (consentsResult.data ?? []) as Array<{ consent_type: string; accepted: boolean }>;

    return {
      onboardingCompleted: Boolean(profile?.onboarding_completed),
      onboardingStep: Number(profile?.onboarding_step ?? 0),
      displayName: typeof profile?.display_name === "string" ? profile.display_name : "",
      preferredName: typeof profile?.preferred_name === "string" ? profile.preferred_name : "",
      timezone: typeof profile?.timezone === "string" ? profile.timezone : "UTC",
      goals: Array.isArray(profile?.goals) ? profile.goals : [],
      buddyTone: typeof profile?.buddy_tone_preference === "string" ? profile.buddy_tone_preference : "gentle",
      startingMood: typeof profile?.starting_mood_preference === "string" ? profile.starting_mood_preference : "calm",
      preferredCheckInTime: typeof (notificationsResult.data as Record<string, unknown> | null)?.reminder_time === "string"
        ? String((notificationsResult.data as Record<string, unknown>).reminder_time).slice(0, 5)
        : null,
      genderIdentity: typeof profile?.gender_identity === "string" ? profile.gender_identity : null,
      genderSelfDescription: typeof profile?.gender_self_description === "string" ? profile.gender_self_description : null,
      pronouns: typeof profile?.pronouns === "string" ? profile.pronouns : null,
      pronounsSelfDescription: typeof profile?.pronouns_self_description === "string" ? profile.pronouns_self_description : null,
      consents: Object.fromEntries(consents.map((c) => [c.consent_type, c.accepted])),
    };
  }
}

