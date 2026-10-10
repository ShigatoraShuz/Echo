"use client";
import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface OnboardingStep {
  id: number;
  label: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 0, label: "Consent" },
  { id: 1, label: "Profile" },
  { id: 2, label: "Setup" },
];

interface StepProgressProps {
  steps: OnboardingStep[];
  currentStep: number;
  className?: string;
}

export function StepProgress({ steps, currentStep, className = "" }: StepProgressProps) {
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <nav aria-label="Onboarding progress" className={`w-full ${className}`}>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--landing-primary-10)]">
        <div
          className="h-full rounded-full bg-[var(--landing-primary)] transition-[width] duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-flow-col sm:auto-cols-fr">
        {steps.map((step) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const isUpcoming = currentStep < step.id;

          return (
            <li key={step.id} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors duration-200",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent && "border-2 border-primary bg-primary/10 text-primary",
                  isUpcoming && "bg-secondary/50 text-muted-foreground"
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : step.id + 1}
              </div>
              <span className={cn("text-xs", isCurrent ? "font-bold text-foreground" : "text-muted-foreground")}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
