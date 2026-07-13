"use client";

import { cn } from "@/lib/utils";

interface EchoBlurTextProps {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  delay?: number;
}

export function EchoBlurText({ children, className, as: Component = "span", delay = 0 }: EchoBlurTextProps) {
  return (
    <Component
      className={cn(
        "transition-all motion-reduce:blur-none motion-reduce:opacity-100",
        "animate-[echo-blur-in_0.6s_ease-out_forwards]",
        className
      )}
      style={{
        opacity: 0,
        filter: "blur(8px)",
        animationDelay: `${delay}ms`,
        animationFillMode: "forwards",
      }}
    >
      {children}
      <style>{`
        @keyframes echo-blur-in {
          to { opacity: 1; filter: blur(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .${cn} { opacity: 1; filter: blur(0); animation: none; }
        }
      `}</style>
    </Component>
  );
}
