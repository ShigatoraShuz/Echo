"use client";

import { CloudSun, Crosshair, Leaf, Monitor, Moon, Sun } from "lucide-react";
import {
  echoThemeDescriptions,
  echoThemeLabels,
  echoThemeModes,
  echoMotionModes,
  echoThemeVariants,
  type EchoThemeMode,
  type EchoMotionMode,
} from "./theme";
import { cn } from "@/shared/lib/utils";
import { useEchoTheme } from "./theme-provider";

const modeLabels: Record<EchoThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const modeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};
const variantIcons = { "echo-calm": Leaf, "echo-night": Moon, "echo-soft": CloudSun, "echo-focus": Crosshair };

export function ThemeVariantSelect({ compact = false }: { compact?: boolean }) {
  const { variant, setVariant } = useEchoTheme();

  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Theme</legend>
      <div className="grid grid-cols-2 gap-2">
        {echoThemeVariants.map((themeVariant) => {
          const Icon = variantIcons[themeVariant];
          return (
          <button
            key={themeVariant}
            type="button"
            onClick={() => setVariant(themeVariant)}
            className={cn(
                "echo-workspace-tile flex min-h-12 items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-medium text-muted-foreground outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.98]",
              variant === themeVariant && "border-primary bg-primary/8 text-foreground shadow-subtle",
            )}
            aria-pressed={variant === themeVariant}
          >
            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            {echoThemeLabels[themeVariant]}
          </button>
          );
        })}
      </div>
      {!compact ? (
        <span className="text-xs leading-5 text-muted-foreground">{echoThemeDescriptions[variant]}</span>
      ) : null}
    </fieldset>
  );
}

export function ThemeModeSelect({ compact = false }: { compact?: boolean }) {
  const { mode, resolvedMode, setMode } = useEchoTheme();

  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Display</legend>
      <div className="grid grid-cols-3 gap-2">
        {echoThemeModes.map((themeMode) => {
          const Icon = modeIcons[themeMode];
          return (
            <button
              key={themeMode}
              type="button"
              onClick={() => setMode(themeMode)}
              aria-pressed={mode === themeMode}
              className={cn(
                "flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-background px-2 py-2 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring/20",
                mode === themeMode && "border-primary bg-primary/8 text-foreground shadow-subtle",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {modeLabels[themeMode]}
            </button>
          );
        })}
      </div>
      {!compact ? (
        <span className="text-xs leading-5 text-muted-foreground">
          Currently rendering in {resolvedMode} mode.
        </span>
      ) : null}
    </fieldset>
  );
}

export function ThemeControls({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid gap-4">
      <ThemeVariantSelect compact={compact} />
      <ThemeModeSelect compact={compact} />
      <MotionPreferenceSelect compact={compact} />
    </div>
  );
}

export function MotionPreferenceSelect({ compact = false }: { compact?: boolean }) {
  const { motion, setMotion } = useEchoTheme();
  const labels: Record<EchoMotionMode, string> = { system: "Follow device", full: "Play animations" };

  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Animation</legend>
      <div className="grid grid-cols-2 gap-2">
        {echoMotionModes.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMotion(option)}
            aria-pressed={motion === option}
            className={cn(
              "min-h-10 rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring/20",
              motion === option && "border-primary bg-primary/8 text-foreground shadow-subtle",
            )}
          >
            {labels[option]}
          </button>
        ))}
      </div>
      {!compact && <p className="text-xs leading-5 text-muted-foreground">
        Play animations overrides this browser&apos;s Reduce Motion setting for ECHO only.
      </p>}
    </fieldset>
  );
}

export const ThemeSelector = ThemeControls;
