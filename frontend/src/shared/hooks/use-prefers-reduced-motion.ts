"use client";

import { useEffect, useState } from "react";

export function shouldReduceMotion() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    document.documentElement.dataset.echoMotion !== "full";
}

export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(shouldReduceMotion());

    updatePreference();
    media.addEventListener("change", updatePreference);
    window.addEventListener("echo:motion-preference-changed", updatePreference);
    return () => {
      media.removeEventListener("change", updatePreference);
      window.removeEventListener("echo:motion-preference-changed", updatePreference);
    };
  }, []);

  return prefersReducedMotion;
}
