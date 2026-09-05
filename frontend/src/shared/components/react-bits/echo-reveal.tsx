"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";

interface EchoRevealProps {
  children: React.ReactNode;
  className?: string;
  direction?: "up" | "down" | "left" | "right" | "none";
  delay?: number;
  duration?: number;
  once?: boolean;
  variant?: "text" | "media" | "card";
}

export function EchoReveal({
  children,
  className,
  direction = "up",
  delay = 0,
  duration,
  once = true,
  variant = "text",
}: EchoRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setVisible(false);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  const directionStyles = {
    up: variant === "text" ? "translate-y-4" : "translate-y-6",
    down: variant === "text" ? "-translate-y-4" : "-translate-y-6",
    left: variant === "text" ? "translate-x-4" : "translate-x-6",
    right: variant === "text" ? "-translate-x-4" : "-translate-x-6",
    none: "",
  };
  const resolvedDuration = duration ?? (variant === "text" ? 620 : 720);
  const hiddenScale = variant === "text" ? "" : "scale-[0.985]";

  return (
    <div
      ref={ref}
      data-echo-reveal={variant}
      data-reveal-visible={visible ? "true" : "false"}
      className={cn(
        "echo-scroll-reveal transition-[opacity,transform]",
        visible
          ? "scale-100 opacity-100 translate-x-0 translate-y-0"
          : `will-change-[opacity,transform] opacity-0 ${directionStyles[direction]} ${hiddenScale}`,
        className
      )}
      style={{
        transitionDuration: `${resolvedDuration}ms`,
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
      }}
    >
      {children}
    </div>
  );
}
