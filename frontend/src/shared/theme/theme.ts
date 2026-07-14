export const ECHO_THEME_STORAGE_KEY = "echo-theme:v1";

export const echoThemeVariants = ["echo-calm", "echo-night", "echo-soft", "echo-focus"] as const;
export const echoThemeModes = ["light", "dark", "system"] as const;

export type EchoThemeVariant = (typeof echoThemeVariants)[number];
export type EchoThemeMode = (typeof echoThemeModes)[number];

export type EchoThemePreferences = {
  variant: EchoThemeVariant;
  mode: EchoThemeMode;
};

export const defaultEchoTheme: EchoThemePreferences = {
  variant: "echo-calm",
  mode: "light",
};

export const echoThemeLabels: Record<EchoThemeVariant, string> = {
  "echo-calm": "Calm",
  "echo-night": "Night",
  "echo-soft": "Soft",
  "echo-focus": "Focus",
};

export const echoThemeDescriptions: Record<EchoThemeVariant, string> = {
  "echo-calm": "Warm cream, sage green, muted teal, soft blue, lavender, and peach accents.",
  "echo-night": "Deep forest, charcoal surfaces, soft cream text, and low-brightness accents.",
  "echo-soft": "Light pastel wellness palette with beige, pale sage, and gentle card contrast.",
  "echo-focus": "Cleaner productivity contrast that stays calm and non-clinical.",
};

export const moodNames = ["calm", "happy", "neutral", "sad", "anxious", "angry"] as const;
export type EchoMood = (typeof moodNames)[number];

export const moodStyles: Record<EchoMood, string> = {
  calm: "mood-badge mood-badge-calm",
  happy: "mood-badge mood-badge-happy",
  neutral: "mood-badge mood-badge-neutral",
  sad: "mood-badge mood-badge-sad",
  anxious: "mood-badge mood-badge-anxious",
  angry: "mood-badge mood-badge-angry",
};

export const moodDotStyles: Record<EchoMood, string> = {
  calm: "bg-calm",
  happy: "bg-happy",
  neutral: "bg-neutral",
  sad: "bg-sad",
  anxious: "bg-anxious",
  angry: "bg-angry",
};

export const riskBandNames = ["low", "mild", "moderate", "high", "severe"] as const;
export type EchoRiskBand = (typeof riskBandNames)[number];

export const riskBandStyles: Record<EchoRiskBand, string> = {
  low: "risk-badge risk-badge-low",
  mild: "risk-badge risk-badge-mild",
  moderate: "risk-badge risk-badge-moderate",
  high: "risk-badge risk-badge-high",
  severe: "risk-badge risk-badge-severe",
};

export const riskBandCardStyles: Record<EchoRiskBand, string> = {
  low: "risk-card risk-card-low",
  mild: "risk-card risk-card-mild",
  moderate: "risk-card risk-card-moderate",
  high: "risk-card risk-card-high",
  severe: "risk-card risk-card-severe",
};

export const echoChartTokens = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
] as const;

export function isEchoThemeVariant(value: unknown): value is EchoThemeVariant {
  return typeof value === "string" && echoThemeVariants.includes(value as EchoThemeVariant);
}

export function isEchoThemeMode(value: unknown): value is EchoThemeMode {
  return typeof value === "string" && echoThemeModes.includes(value as EchoThemeMode);
}

export function normalizeThemePreferences(value: unknown): EchoThemePreferences {
  if (!value || typeof value !== "object") {
    return defaultEchoTheme;
  }
  const candidate = value as Partial<EchoThemePreferences>;
  return {
    variant: isEchoThemeVariant(candidate.variant) ? candidate.variant : defaultEchoTheme.variant,
    mode: isEchoThemeMode(candidate.mode) ? candidate.mode : defaultEchoTheme.mode,
  };
}
