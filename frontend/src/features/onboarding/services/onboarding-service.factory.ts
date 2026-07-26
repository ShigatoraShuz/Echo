import type { OnboardingService } from "./onboarding.service";
import { createOnboardingMockAdapter } from "./onboarding.mock-adapter";

let instance: OnboardingService | null = null;

export function getOnboardingService(): OnboardingService {
  if (instance) return instance;
  instance = createOnboardingMockAdapter();
  return instance;
}
