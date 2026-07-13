"use client";

import { cn } from "@/lib/utils";

interface EchoStepTransitionProps {
  children: React.ReactNode;
  isActive: boolean;
  className?: string;
  direction?: "forward" | "backward";
}

export function EchoStepTransition({ children, isActive, className, direction = "forward" }: EchoStepTransitionProps) {
  const offset = direction === "forward" ? "translate-x-6" : "-translate-x-6";

  return (
    <div
      className={cn(
        "transition-all duration-300 motion-reduce:opacity-100 motion-reduce:translate-x-0",
        isActive ? "opacity-100 translate-x-0" : `opacity-0 ${offset} pointer-events-none absolute`,
        className
      )}
      aria-hidden={!isActive}
    >
      {children}
    </div>
  );
}
