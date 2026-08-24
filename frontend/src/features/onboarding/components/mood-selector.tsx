"use client";

import { useState } from "react";
import { moodNames, moodStyles, type EchoMood } from "@/shared/lib/theme";
import { cn } from "@/shared/lib/utils";

export function MoodSelector({
  initialMood = "calm",
  onMoodSelect,
}: {
  initialMood?: EchoMood;
  onMoodSelect?: (mood: EchoMood) => void;
}) {
  const [selectedMood, setSelectedMood] = useState<EchoMood>(initialMood);

  const handleSelect = (mood: EchoMood) => {
    setSelectedMood(mood);
    onMoodSelect?.(mood);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {moodNames.map((mood) => (
        <button
          key={mood}
          type="button"
          onClick={() => handleSelect(mood)}
          className={cn(
            "min-h-28 rounded-2xl border border-border/70 bg-background p-4 text-left shadow-subtle transition hover:bg-muted",
            selectedMood === mood && "ring-4 ring-primary/10",
          )}
          aria-pressed={selectedMood === mood}
        >
          <span className={cn(moodStyles[mood], "inline-flex max-w-full items-center whitespace-nowrap")}>{mood}</span>
          <span className="mt-3 block text-xs leading-5 text-muted-foreground">Use this mood for the current reflection.</span>
        </button>
      ))}
    </div>
  );
}
