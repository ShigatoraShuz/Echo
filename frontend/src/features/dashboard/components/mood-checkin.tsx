"use client";
import { useState } from "react";
import { Frown, Meh, Smile, Heart, Angry } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export type QuickMood = "awful" | "bad" | "okay" | "good" | "great";

const MOODS: Array<{ value: QuickMood; icon: typeof Heart; label: string }> = [
  { value: "awful", icon: Angry, label: "Awful" },
  { value: "bad", icon: Frown, label: "Bad" },
  { value: "okay", icon: Meh, label: "Okay" },
  { value: "good", icon: Smile, label: "Good" },
  { value: "great", icon: Heart, label: "Great" },
];

interface MoodCheckInProps {
  onSelect: (mood: QuickMood) => void;
}

export function MoodCheckIn({ onSelect }: MoodCheckInProps) {
  const [selected, setSelected] = useState<QuickMood | null>(null);

  function handleSelect(mood: QuickMood) {
    setSelected(mood);
    onSelect(mood);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">How are you feeling?</p>
      <div className="mt-4 flex justify-between gap-2">
        {MOODS.map((mood) => {
          const Icon = mood.icon;
          const isSelected = selected === mood.value;
          return (
            <button
              key={mood.value}
              type="button"
              onClick={() => handleSelect(mood.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl p-3 transition-colors",
                isSelected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/50"
              )}
            >
              <Icon className={cn("h-6 w-6", isSelected && "text-primary")} />
              <span className="text-[10px] font-medium">{mood.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
