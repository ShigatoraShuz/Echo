import type { OnboardingData } from "@/features/onboarding/model/onboarding.model";

export type OnboardingServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export interface OnboardingStatus {
  onboardingCompleted: boolean;
  displayName: string;
  timezone: string;
  consents: Record<string, boolean>;
}

export interface OnboardingService {
  getStatus(): Promise<OnboardingServiceResult<OnboardingStatus>>;
  saveConsent(consent: Record<string, boolean>): Promise<OnboardingServiceResult<void>>;
  saveProfile(profile: OnboardingData["profile"]): Promise<OnboardingServiceResult<void>>;
  saveSetup(setup: OnboardingData["setup"]): Promise<OnboardingServiceResult<void>>;
  completeOnboarding(): Promise<OnboardingServiceResult<void>>;
}
