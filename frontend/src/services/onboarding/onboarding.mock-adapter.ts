import type { OnboardingService } from "@/services/onboarding/onboarding.service";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createOnboardingMockAdapter(): OnboardingService {
  return {
    async getStatus() {
      await delay(100);
      return {
        success: true,
        data: {
          onboardingCompleted: false,
          displayName: "",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          consents: {},
        },
      };
    },
    async saveConsent() {
      await delay(150);
      return { success: true, data: undefined as unknown as void };
    },
    async saveProfile() {
      await delay(150);
      return { success: true, data: undefined as unknown as void };
    },
    async saveSetup() {
      await delay(150);
      return { success: true, data: undefined as unknown as void };
    },
    async completeOnboarding() {
      await delay(200);
      return { success: true, data: undefined as unknown as void };
    },
  };
}
