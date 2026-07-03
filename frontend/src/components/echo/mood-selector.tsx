"use client";

import { useState } from "react";
import { moodNames, moodStyles, type EchoMood } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function MoodSelector({ initialMood = "calm" }: { initialMood?: EchoMood }) {
  const [selectedMood, setSelectedMood] = useState<EchoMood>(initialMood);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {moodNames.map((mood) => (
        <button
          key={mood}
          type="button"
          onClick={() => setSelectedMood(mood)}
          className={cn(
            "rounded-2xl border border-border/70 bg-background p-4 text-left shadow-subtle transition hover:bg-muted",
            selectedMood === mood && "ring-4 ring-primary/10",
          )}
          aria-pressed={selectedMood === mood}
        >
          <span className={moodStyles[mood]}>{mood}</span>
          <span className="mt-3 block text-xs leading-5 text-muted-foreground">Use this mood for the current reflection.</span>
        </button>
      ))}
    </div>
  );
}
