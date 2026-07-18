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
