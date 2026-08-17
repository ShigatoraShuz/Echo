import type { OnboardingService, OnboardingServiceResult } from "./onboarding.service";
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
    async saveConsent(consent: Record<string, boolean>): Promise<OnboardingServiceResult<void>> {
      try {
        await client.post("/onboarding/consent", {
          terms: consent.terms ?? false,
          privacy: consent.privacy ?? false,
          dataProcessing: consent.dataProcessing ?? false,
          aiInformation: consent.aiInformation ?? false,
          journalAnalysis: consent.journalAnalysis ?? false,
        });
        return { success: true, data: undefined as unknown as void };
      } catch (error) {
        const normalized = normalizeError(error);
        return { success: false, error: { code: normalized.code, message: normalized.userMessage } };
      }
    },

    async saveProfile(profile: OnboardingData["profile"]): Promise<OnboardingServiceResult<void>> {
      try {
        await client.post("/onboarding/profile", {
          displayName: profile.displayName,
          timezone: profile.timezone,
          goals: profile.goals,
          buddyTone: profile.buddyTone,
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
