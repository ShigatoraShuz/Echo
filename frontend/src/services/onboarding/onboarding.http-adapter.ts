import type { OnboardingService, OnboardingServiceResult, OnboardingStatus } from "./onboarding.service";
import type { OnboardingData } from "@/features/onboarding/model/onboarding.model";
import { env } from "@/config/environment";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import { normalizeError } from "@/shared/errors/normalize-error";

export function createOnboardingHttpAdapter(): OnboardingService {
  const client = createApiClient({
    baseUrl: env.apiBaseUrl,
    tokenProvider: supabaseAuthTokenProvider,
  });

  return {
    async getStatus(): Promise<OnboardingServiceResult<OnboardingStatus>> {
      try {
        const response = await client.get<{ success: true; data: OnboardingStatus }>("/onboarding/status");
        return { success: true, data: response.data };
      } catch (error) {
        const normalized = normalizeError(error);
        return { success: false, error: { code: normalized.code, message: normalized.userMessage } };
      }
    },

    async saveProfile(profile: OnboardingData["profile"]): Promise<OnboardingServiceResult<void>> {
      try {
        await client.post("/onboarding/profile", {
          displayName: profile.displayName,
          preferredName: profile.preferredName ?? profile.displayName,
          timezone: profile.timezone,
          goals: profile.goals,
          buddyTone: profile.buddyTone,
          preferredCheckInTime: profile.preferredCheckInTime,
          startingMood: profile.startingMood,
        });
        return { success: true, data: undefined as unknown as void };
      } catch (error) {
        const normalized = normalizeError(error);
        return { success: false, error: { code: normalized.code, message: normalized.userMessage } };
      }
    },

    async saveSetup(setup: OnboardingData["setup"]): Promise<OnboardingServiceResult<void>> {
      try {
        await client.post("/onboarding/setup", {
          theme: setup.theme,
          notifications: setup.notifications,
          genderIdentity: setup.genderIdentity,
          genderSelfDescription: setup.genderSelfDescription,
          pronouns: setup.pronouns,
          pronounsSelfDescription: setup.pronounsSelfDescription,
        });
        return { success: true, data: undefined as unknown as void };
      } catch (error) {
        const normalized = normalizeError(error);
        return { success: false, error: { code: normalized.code, message: normalized.userMessage } };
      }
    },

    async completeOnboarding(): Promise<OnboardingServiceResult<void>> {
      try {
        await client.post("/onboarding/complete", {});
        return { success: true, data: undefined as unknown as void };
      } catch (error) {
        const normalized = normalizeError(error);
        return { success: false, error: { code: normalized.code, message: normalized.userMessage } };
      }
    },
  };
}
