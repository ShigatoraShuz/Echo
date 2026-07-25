"use client";
import { PACE_OPTIONS } from "../model/grounding.constants";
import type { PaceType } from "../model/grounding.model";

interface PaceSelectorProps {
  value: PaceType;
  onChange: (pace: PaceType) => void;
  disabled?: boolean;
}

export function PaceSelector({ value, onChange, disabled }: PaceSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Pace</label>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Exercise pace">
        {PACE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={ounded-full px-4 py-2 text-sm font-semibold transition-colors  disabled:opacity-50}
            title={opt.description}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
