"use client";

import { ReactLenis } from "lenis/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { usePrefersReducedMotion } from "@/shared/hooks/use-prefers-reduced-motion";

const smoothScrollOptions = {
  anchors: { immediate: true, offset: -96 },
  autoRaf: true,
  lerp: 0.1,
  smoothWheel: true,
  stopInertiaOnNavigate: true,
  syncTouch: false,
  wheelMultiplier: 0.9,
} as const;

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = usePrefersReducedMotion();

  if (prefersReducedMotion || pathname === "/crisis") {
    return children;
  }

  return (
    <ReactLenis root options={smoothScrollOptions}>
      {children}
    </ReactLenis>
  );
}
