export const DURATION_OPTIONS = [
  { value: 60, label: "1 min" },
  { value: 180, label: "3 min" },
  { value: 300, label: "5 min" },
  { value: 600, label: "10 min" },
] as const;

export const PACE_OPTIONS = [
  { value: "slow" as const, label: "Slow", description: "Gentle, extended breaths" },
  { value: "medium" as const, label: "Medium", description: "Balanced rhythm" },
  { value: "fast" as const, label: "Fast", description: "Quick, steady pace" },
] as const;

export const PACE_INTERVALS = {
  slow: { inhale: 6000, hold: 4000, exhale: 8000 },
  medium: { inhale: 4000, hold: 3000, exhale: 6000 },
  fast: { inhale: 3000, hold: 2000, exhale: 4000 },
} as const;

export const SENSORY_STEPS = [
  { id: "see", label: "See", description: "Name 5 things you can see around you", duration: 15000 },
  { id: "touch", label: "Touch", description: "Name 4 things you can physically feel", duration: 15000 },
  { id: "hear", label: "Hear", description: "Name 3 things you can hear", duration: 15000 },
  { id: "smell", label: "Smell", description: "Name 2 things you can smell", duration: 15000 },
  { id: "taste", label: "Taste", description: "Name 1 thing you can taste", duration: 15000 },
] as const;
