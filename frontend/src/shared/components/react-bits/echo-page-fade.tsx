"use client";

import { cn } from "@/shared/lib/utils";

interface EchoPageFadeProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
}

/**
 * Page-level entrance animation: fades the page content in from the top
 * (starts slightly above its final position and fades to full opacity).
 * Respects prefers-reduced-motion via the motion-reduce utilities.

export function EchoPageFade({ children, className, duration = 520 }: EchoPageFadeProps) {
  return (
    <div
      className={cn(
        "echo-page-fade motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none",
        className
      )}
      style={{ animationDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );