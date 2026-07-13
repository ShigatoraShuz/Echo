"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface EchoCountUpProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  decimals?: number;
}

export function EchoCountUp({ end, duration = 1500, prefix = "", suffix = "", className, decimals = 0 }: EchoCountUpProps) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || started.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(end * eased);
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [end, duration]);

  return (
    <span
      ref={ref}
      className={cn("motion-reduce:animate-none", className)}
      aria-label={`${prefix}${end.toFixed(decimals)}${suffix}`}
    >
      {prefix}{count.toFixed(decimals)}{suffix}
    </span>
  );
}
