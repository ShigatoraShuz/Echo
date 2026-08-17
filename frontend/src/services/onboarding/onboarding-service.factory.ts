import type { OnboardingService } from "@/services/onboarding/onboarding.service";
import { createOnboardingMockAdapter } from "@/services/onboarding/onboarding.mock-adapter";
import { createOnboardingHttpAdapter } from "@/services/onboarding/onboarding.http-adapter";
import { env } from "@/config/environment";

let instance: OnboardingService | null = null;

export function getOnboardingService(): OnboardingService {
  if (instance) return instance;
  instance = env.dataAdapter === "mock" ? createOnboardingMockAdapter() : createOnboardingHttpAdapter();
  return instance;
}
