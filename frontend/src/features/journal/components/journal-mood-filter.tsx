"use client";
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
      <button type="button" onClick={() => onChange(null)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${value === null ? "bg-primary text-primary-foreground" : "bg-secondary/40 text-muted-foreground"}`}>All</button>
      {MOODS.map((mood) => (
        <button key={mood.value} type="button" onClick={() => onChange(mood.value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${value === mood.value ? "bg-primary text-primary-foreground" : "bg-secondary/40 text-muted-foreground"}`}>{mood.label}</button>
      ))}
    </div>
  );
}
