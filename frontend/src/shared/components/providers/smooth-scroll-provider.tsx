"use client";

import { ReactLenis } from "lenis/react";
import type { ReactNode } from "react";

import { usePrefersReducedMotion } from "@/shared/hooks/use-prefers-reduced-motion";

const smoothScrollOptions = {
  anchors: true,
  autoRaf: true,
  lerp: 0.1,
  smoothWheel: true,
  stopInertiaOnNavigate: true,
  syncTouch: false,
  wheelMultiplier: 0.9,
} as const;

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  if (prefersReducedMotion) {
    return children;
  }

  return (
    <ReactLenis root options={smoothScrollOptions}>
      {children}
    </ReactLenis>
  );
}
