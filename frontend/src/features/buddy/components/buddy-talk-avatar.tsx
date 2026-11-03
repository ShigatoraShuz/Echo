"use client";
import { useEffect, useRef } from "react";

export function BuddyTalkAvatar({ state, analyser }: { state: string; analyser: AnalyserNode | null }) {
  const mouth = useRef<SVGEllipseElement>(null);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const samples = new Uint8Array(analyser?.fftSize ?? 256);
    const reset = () => mouth.current?.setAttribute("ry", "2");
    const tick = () => {
      if (!analyser || state !== "speaking" || preference.matches) {
        reset();
        return;
      }
      analyser.getByteTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, x) => sum + ((x - 128) / 128) ** 2, 0) / samples.length);
      mouth.current?.setAttribute("ry", String(2 + Math.min(9, rms * 45)));
      frame = requestAnimationFrame(tick);
    };
    const change = () => {
      cancelAnimationFrame(frame);
      tick();
    };
    change();
    preference.addEventListener("change", change);
    return () => {
      cancelAnimationFrame(frame);
      reset();
      preference.removeEventListener("change", change);
    };
  }, [state, analyser]);
  return (
    <svg width="48" height="48" viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <circle cx="32" cy="32" r="29" fill="var(--landing-primary-20, #d5e9df)" />
      <circle cx="22" cy="25" r="3" fill="currentColor" />
      <circle cx="42" cy="25" r="3" fill="currentColor" />
      <ellipse ref={mouth} cx="32" cy="42" rx="9" ry="2" fill="currentColor" />
    </svg>
  );
}
