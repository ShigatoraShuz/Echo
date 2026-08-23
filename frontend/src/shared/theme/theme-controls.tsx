"use client";

import { Monitor, Moon, Palette, Sun } from "lucide-react";
import {
  echoThemeDescriptions,
  echoThemeLabels,
  echoThemeModes,
  echoThemeVariants,
  type EchoThemeMode,
  type EchoThemeVariant,
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

export function ThemeVariantSelect({ compact = false }: { compact?: boolean }) {
  const { variant, setVariant } = useEchoTheme();
  const applyVariant = (value: string) => setVariant(value as EchoThemeVariant);

  return (
    <div className={cn("grid gap-2", compact && "gap-3")}>
      {!compact ? <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Theme</span> : null}
      <span className="relative">
        <Palette className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
        <select
          value={variant}
          onChange={(event) => applyVariant(event.currentTarget.value)}
          onInput={(event) => applyVariant(event.currentTarget.value)}
          className={cn("echo-input appearance-none pl-10 pr-9", compact && "h-10")}
          aria-label="Choose ECHO theme variant"
        >
          {echoThemeVariants.map((themeVariant) => (
            <option key={themeVariant} value={themeVariant}>
              {echoThemeLabels[themeVariant]}
            </option>
          ))}
        </select>
      </span>
      <span className={cn("grid gap-2", compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
        {echoThemeVariants.map((themeVariant) => (
          <button
            key={themeVariant}
            type="button"
            onClick={() => setVariant(themeVariant)}
            className={cn(
              "rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-semibold text-muted-foreground outline-none transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:-translate-y-px hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.98]",
              variant === themeVariant && "border-primary bg-primary/8 text-foreground shadow-subtle",
            )}
            aria-pressed={variant === themeVariant}
          >
            {echoThemeLabels[themeVariant]}
          </button>
        ))}
      </span>
      {!compact ? (
        <span className="text-xs leading-5 text-muted-foreground">{echoThemeDescriptions[variant]}</span>
      ) : null}
    </div>
  );
}

export function ThemeModeSelect({ compact = false }: { compact?: boolean }) {
  const { mode, resolvedMode, setMode } = useEchoTheme();
  const ActiveIcon = modeIcons[mode];
  const applyMode = (value: string) => setMode(value as EchoThemeMode);

  return (
    <div className={cn("grid gap-2", compact && "gap-3")}>
      {!compact ? <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mode</span> : null}
      <span className="relative">
        <ActiveIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
        <select
          value={mode}
          onChange={(event) => applyMode(event.currentTarget.value)}
          onInput={(event) => applyMode(event.currentTarget.value)}
          className={cn("echo-input appearance-none pl-10 pr-9", compact && "h-10")}
          aria-label="Choose light, dark, or system mode"
        >
          {echoThemeModes.map((themeMode) => (
            <option key={themeMode} value={themeMode}>
              {modeLabels[themeMode]}
            </option>
          ))}
        </select>
      </span>
      {!compact ? (
        <span className="text-xs leading-5 text-muted-foreground">
          Currently rendering in {resolvedMode} mode.
        </span>
      ) : null}
    </div>
  );
}

export function ThemeControls({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-4 md:grid-cols-2"}>
      <ThemeVariantSelect compact={compact} />
      <ThemeModeSelect compact={compact} />
    </div>
  );
}

export const ThemeSelector = ThemeControls;
