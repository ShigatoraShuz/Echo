export const MOTION = {
  durations: {
    instant: 0,
    fast: 150,
    normal: 300,
    slow: 500,
    deliberate: 800,
  },
  reducedMotionDuration: 0,
  easings: {
    standard: [0.4, 0, 0.2, 1] as const,
    enter: [0, 0, 0.2, 1] as const,
    exit: [0.4, 0, 1, 1] as const,
  },
  stagger: {
    small: 30,
    medium: 60,
    large: 100,
  },
  defaultRevealDistance: 20,
} as const;

export type MotionDuration = keyof typeof MOTION.durations;
export type MotionEasing = keyof typeof MOTION.easings;
export type StaggerStep = keyof typeof MOTION.stagger;
