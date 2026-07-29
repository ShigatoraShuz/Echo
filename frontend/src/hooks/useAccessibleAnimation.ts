import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

interface AnimationConfig {
  duration: number;
  reducedDuration?: number;
  easing?: string;
}

export function useAccessibleAnimation(config: AnimationConfig) {
  const prefersReduced = usePrefersReducedMotion();
  return {
    duration: prefersReduced ? (config.reducedDuration ?? 0) : config.duration,
    easing: prefersReduced ? "step-end" : (config.easing ?? "ease-in-out"),
    shouldAnimate: !prefersReduced,
  };
}
