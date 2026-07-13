"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface EchoAnimatedListProps {
  children: React.ReactNode[];
  className?: string;
  staggerDelay?: number;
}

export function EchoAnimatedList({ children, className, staggerDelay = 50 }: EchoAnimatedListProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn(className)}>
      {children.map((child, index) => (
        <div
          key={index}
          className={cn(
            "transition-all motion-reduce:opacity-100 motion-reduce:translate-y-0",
            visible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          )}
          style={{
            transitionDuration: "400ms",
            transitionDelay: `${index * staggerDelay}ms`,
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
