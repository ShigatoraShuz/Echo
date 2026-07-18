export type LandingActionVariant = "primary" | "outline";

export type LandingStatIcon = "privacy" | "moods" | "grounding";

export interface LandingAction {
  text: string;
  href: string;
  variant: LandingActionVariant;
}

export interface LandingStat {
  value: string;
  label: string;
  icon: LandingStatIcon;
}

export interface LandingHeroContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions: LandingAction[];
  stats: LandingStat[];
}
