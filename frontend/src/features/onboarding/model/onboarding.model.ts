export interface ConsentOption {
  key: string;
  title: string;
  description: string;
  required: boolean;
}

export interface OnboardingProfile {
  displayName: string;
  preferredName?: string;
  timezone: string;
  goals: string;
  buddyTone: string;
}

export interface OnboardingSetup {
  theme: "light" | "dark" | "system";
  notifications: boolean;
  genderIdentity?: "woman" | "man" | "non_binary" | "self_describe" | "prefer_not_to_say" | null;
  genderSelfDescription?: string | null;
  pronouns?: "she_her" | "he_him" | "they_them" | "use_my_name" | "self_describe" | "prefer_not_to_say" | null;
  pronounsSelfDescription?: string | null;
}

export interface OnboardingData {
  consent: Record<string, boolean>;
  profile: OnboardingProfile;
  setup: OnboardingSetup;
  currentStep: number;
}
