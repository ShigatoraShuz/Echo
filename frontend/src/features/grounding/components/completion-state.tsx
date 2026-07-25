"use client";
import { CheckCircle, RotateCcw } from "lucide-react";

interface CompletionStateProps {
  exerciseType: string;
  duration: number;
  onRepeat: () => void;
}

export function GroundingCompletionState({ exerciseType, duration, onRepeat }: CompletionStateProps) {
  const durationMin = Math.ceil(duration / 60);

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-success/10 text-success">
        <CheckCircle className="h-8 w-8" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-xl font-semibold text-foreground">Exercise complete</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        You completed a {durationMin}-minute {exerciseType.replace(/-/g, " ")} exercise. Gentle progress is still progress.
      </p>
      <button
        type="button"
        onClick={onRepeat}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
      >
        <RotateCcw className="h-4 w-4" /> Repeat exercise
      </button>
    </div>
  );
}
