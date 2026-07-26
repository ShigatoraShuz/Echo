export interface ConsentOption {
  key: string;
  title: string;
  description: string;
  required: boolean;
}

export interface OnboardingProfile {
  displayName: string;
  timezone: string;
  goals: string;
  buddyTone: string;
}

export interface OnboardingSetup {
  theme: "light" | "dark" | "system";
  notifications: boolean;
}

export interface OnboardingData {
  consent: Record<string, boolean>;
  profile: OnboardingProfile;
  setup: OnboardingSetup;
  currentStep: number;
}
