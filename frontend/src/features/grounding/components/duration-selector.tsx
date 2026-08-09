"use client";
import { DURATION_OPTIONS } from "../model/grounding.constants";

interface DurationSelectorProps {
  value: number;
  onChange: (duration: number) => void;
  disabled?: boolean;
}

export function DurationSelector({ value, onChange, disabled }: DurationSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Duration</label>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Exercise duration">
        {DURATION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${value === opt.value ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground"} disabled:opacity-50`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
