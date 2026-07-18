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
  title: "ECHO — Private reflection, at your pace",
  description:
    "Private journaling, guided reflection, mood check-ins, emotional patterns, and grounding tools in one calm space.",
} as const;

export const LANDING_HERO_CONTENT: LandingHeroContent = {
  eyebrow: "Your private wellness companion",
  title: "Private Reflection",
  subtitle:
    "ECHO brings private journaling, guided reflection, six mood check-ins, emotional patterns, and grounding tools together in one calm space.",
  actions: [
    { text: "Start privately", href: "/signup", variant: "primary" },
    { text: "Explore features", href: "#features", variant: "outline" },
  ],
  stats: [
    { value: "Private", label: "by default", icon: "privacy" },
    { value: "6 moods", label: "for gentle check-ins", icon: "moods" },
    { value: "Grounding tools", label: "guided exercises", icon: "grounding" },
  ],
};
