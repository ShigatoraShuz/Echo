"use client";

import { cn } from "@/lib/utils";

interface EchoFadeProps {
  children: React.ReactNode;
  className?: string;
  show?: boolean;
  duration?: number;
}

export function EchoFade({ children, className, show = true, duration = 300 }: EchoFadeProps) {
  return (
    <div
      className={cn(
        "transition-opacity motion-reduce:opacity-100",
        show ? "opacity-100" : "opacity-0",
        className
      )}
      style={{ transitionDuration: `${duration}ms` }}
      aria-hidden={!show ? true : undefined}
    >
      {children}
    </div>
  );
}
