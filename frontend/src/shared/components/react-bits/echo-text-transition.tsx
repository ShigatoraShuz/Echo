"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface EchoTextTransitionProps {
  texts: string[];
  interval?: number;
  className?: string;
}

export function EchoTextTransition({ texts, interval = 3000, className }: EchoTextTransitionProps) {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (texts.length <= 1) return;
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % texts.length);
        setFade(true);
      }, 200);
    }, interval);
    return () => clearInterval(timer);
  }, [texts, interval]);

  return (
    <span
      className={cn(
        "inline-block transition-opacity duration-200 motion-reduce:opacity-100",
        fade ? "opacity-100" : "opacity-0",
        className
      )}
      aria-live="polite"
    >
      {texts[index]}
    </span>
  );
}
