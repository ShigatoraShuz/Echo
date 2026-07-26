"use client";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeSelectorProps {
  selected: "light" | "dark" | "system";
  onChange: (theme: "light" | "dark" | "system") => void;
}

const THEMES = [
  { value: "light" as const, label: "Light", description: "Bright and airy", icon: Sun },
  { value: "dark" as const, label: "Dark", description: "Easy on the eyes", icon: Moon },
  { value: "system" as const, label: "System", description: "Follows your device", icon: Monitor },
];

export function ThemeSelector({ selected, onChange }: ThemeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Theme preference</label>
      <div className="grid grid-cols-3 gap-3">
        {THEMES.map((theme) => {
          const Icon = theme.icon;
          const isSelected = selected === theme.value;
          return (
            <button
              key={theme.value}
              type="button"
              onClick={() => onChange(theme.value)}
              className={cn(
                "rounded-xl border p-4 text-center transition-colors",
                isSelected ? "border-primary bg-primary/[0.03]" : "border-border bg-card hover:bg-secondary/30"
              )}
            >
              <Icon className={cn("mx-auto h-6 w-6", isSelected ? "text-primary" : "text-muted-foreground")} />
              <p className="mt-2 text-sm font-medium text-foreground">{theme.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{theme.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
