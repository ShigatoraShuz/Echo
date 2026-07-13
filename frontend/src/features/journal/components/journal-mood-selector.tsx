"use client";

import type { JournalMood } from "../model/journal.model";
import { MOOD_LABELS } from "../model/journal.schema";

interface JournalMoodSelectorProps {
  value: JournalMood;
  onChange: (mood: JournalMood) => void;
  disabled?: boolean;
}

const moodOrder: JournalMood[] = ["calm", "happy", "neutral", "sad", "anxious", "angry"];

export function JournalMoodSelector({ value, onChange, disabled }: JournalMoodSelectorProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-foreground">Mood</legend>
      <div className="flex flex-wrap gap-2">
        {moodOrder.map((mood) => {
          const isActive = value === mood;
          return (
            <button
              key={mood}
              type="button"
              disabled={disabled}
              onClick={() => onChange(mood)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20 disabled:opacity-50 ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/70 bg-card text-foreground hover:bg-muted"
              }`}
            >
              {MOOD_LABELS[mood]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
