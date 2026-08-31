"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { PACE_INTERVALS } from "../model/grounding.constants";
import type { PaceType } from "../model/grounding.model";

interface BoxBreathingProps {
  pace?: PaceType;
  onComplete: () => void;
}

type Phase = "inhale" | "hold" | "exhale" | "rest";

const PHASE_LABELS: Record<Phase, string> = {
  inhale: "Breathe in",
  hold: "Hold",
  exhale: "Breathe out",
  rest: "Rest",
};

const PHASES: Phase[] = ["inhale", "hold", "exhale", "rest"];

export function BoxBreathing({ pace = "medium", onComplete }: BoxBreathingProps) {
  const [phase, setPhase] = useState<Phase>("inhale");
  const [progress, setProgress] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const intervals = PACE_INTERVALS[pace];
  const phaseDurations = useMemo(
    () => [intervals.inhale, intervals.hold, intervals.exhale, intervals.hold],
    [intervals],
  );

  const tick = useCallback(() => {
    setProgress((prev) => {
      const currentPhaseIndex = PHASES.indexOf(phase);
      const maxDuration = phaseDurations[currentPhaseIndex];
      const next = prev + 50;
      if (next >= maxDuration) {
        const nextPhaseIndex = (currentPhaseIndex + 1) % PHASES.length;
        if (nextPhaseIndex === 0) onComplete();
        setPhase(PHASES[nextPhaseIndex]);
        return 0;
      }
      return next;
    });
  }, [phase, phaseDurations, onComplete]);

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(tick, 50);
    return () => clearInterval(id);
  }, [isActive, tick]);

  const currentPhaseIndex = PHASES.indexOf(phase);
  const currentDuration = phaseDurations[currentPhaseIndex];
  const pct = (progress / currentDuration) * 100;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">Box breathing</p>
      <div className="mx-auto mt-6 grid h-48 w-48 place-items-center">
        <div className="relative h-40 w-40">
          <div className="absolute inset-0 rounded-lg border-2 border-primary/30 transition-all" style={{ transform: `scale(${pct / 100})`, opacity: phase === "rest" ? 0.5 : 1 }} />
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-lg font-semibold text-foreground">{PHASE_LABELS[phase]}</span>
          </div>
        </div>
      </div>
      <button type="button" onClick={() => setIsActive(!isActive)} className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
        {isActive ? "Pause" : "Start"}
      </button>
    </div>
  );
}
