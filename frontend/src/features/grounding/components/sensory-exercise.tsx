"use client";
import { useState } from "react";
import { SENSORY_STEPS } from "../model/grounding.constants";

interface SensoryExerciseProps {
  onComplete: () => void;
}

export function SensoryExercise({ onComplete }: SensoryExerciseProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const step = SENSORY_STEPS[currentStep];
  const isLastStep = currentStep >= SENSORY_STEPS.length - 1;

  function nextStep() {
    if (isLastStep) { onComplete(); return; }
    setCurrentStep((prev) => prev + 1);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">5-4-3-2-1 Sensory exercise</p>
      <h3 className="mt-4 text-3xl font-serif text-foreground">{step.label}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
      <p className="mt-6 text-sm text-muted-foreground">Step {currentStep + 1} of {SENSORY_STEPS.length}</p>
      <div className="mt-4 flex justify-center gap-3">
        <button type="button" onClick={() => setIsActive(!isActive)} className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
          {isActive ? "Pause" : "Start"}
        </button>
        <button type="button" onClick={nextStep} className="rounded-full border border-border bg-background px-6 py-2.5 text-sm font-bold text-foreground hover:bg-secondary/60">
          {isLastStep ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
