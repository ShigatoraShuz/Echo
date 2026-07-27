"use client";
import { MOOD_LABELS } from "../model/journal.constants";
import type { JournalMood } from "../model/journal.model";

interface JournalMoodFilterProps {
  value: JournalMood | null;
  onChange: (mood: JournalMood | null) => void;
}

const MOODS: Array<{ value: JournalMood; label: string }> = [
  { value: "calm", label: "Calm" },
  { value: "happy", label: "Happy" },
  { value: "neutral", label: "Neutral" },
  { value: "sad", label: "Sad" },
  { value: "anxious", label: "Anxious" },
  { value: "angry", label: "Angry" },
];

export function JournalMoodFilter({ value, onChange }: JournalMoodFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => onChange(null)} className={ounded-full px-3 py-1.5 text-xs font-semibold transition-colors }>All</button>
      {MOODS.map((mood) => (
        <button key={mood.value} type="button" onClick={() => onChange(mood.value)} className={ounded-full px-3 py-1.5 text-xs font-semibold transition-colors }>{mood.label}</button>
      ))}
    </div>
  );
}
