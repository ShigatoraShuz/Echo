"use client";
import { Sparkles, Heart, Compass, Sun } from "lucide-react";

interface GoalsSelectorProps {
  selectedGoal: string;
  onSelect: (goal: string) => void;
}

const GOALS = [
  { value: "reflect", label: "Daily reflection", description: "Build a consistent journaling practice", icon: Sun },
  { value: "understand", label: "Understand patterns", description: "Discover emotional trends and triggers", icon: Compass },
  { value: "ground", label: "Stay grounded", description: "Use grounding exercises during difficult moments", icon: Heart },
  { value: "grow", label: "Personal growth", description: "Develop self-awareness and emotional resilience", icon: Sparkles },
];

export function GoalsSelector({ selectedGoal, onSelect }: GoalsSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">What brings you to ECHO?</label>
      <div className="grid gap-3 sm:grid-cols-2">
        {GOALS.map((goal) => {
          const Icon = goal.icon;
          const isSelected = selectedGoal === goal.value;
          return (
            <button
              key={goal.value}
              type="button"
              onClick={() => onSelect(goal.value)}
              className={`rounded-xl border p-4 text-left transition-colors ${isSelected ? "border-primary bg-primary/5" : ""}`}
            >
              <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
              <p className="mt-2 text-sm font-medium text-foreground">{goal.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{goal.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const TONES = [
  { value: "gentle", label: "Gentle", description: "Soft, warm, and reassuring" },
  { value: "direct", label: "Direct", description: "Clear, honest, and straightforward" },
  { value: "curious", label: "Curious", description: "Inquisitive, exploring, and open-ended" },
];

interface BuddyToneSelectorProps {
  selectedTone: string;
  onSelect: (tone: string) => void;
}

export function BuddyToneSelector({ selectedTone, onSelect }: BuddyToneSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Buddy tone preference</label>
      <div className="flex flex-wrap gap-2">
        {TONES.map((tone) => (
          <button
            key={tone.value}
            type="button"
            onClick={() => onSelect(tone.value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${selectedTone === tone.value ? "bg-primary text-primary-foreground" : "bg-secondary/40 text-muted-foreground"}`}
            title={tone.description}
          >
            {tone.label}
          </button>
        ))}
      </div>
    </div>
  );
}
