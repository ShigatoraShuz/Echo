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

export const LANDING_PAGE_METADATA = {
  title: "ECHO - Private reflection, at your pace",
  description:
    "Private journaling, guided reflection, mood check-ins, emotional patterns, and grounding tools in one calm space.",
} as const;
