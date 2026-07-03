"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  defaultEchoTheme,
  ECHO_THEME_STORAGE_KEY,
  type EchoThemeMode,
  type EchoThemePreferences,
  type EchoThemeVariant,
  isEchoThemeMode,
  isEchoThemeVariant,
  normalizeThemePreferences,
} from "@/lib/theme";

type ThemeContextValue = EchoThemePreferences & {
  resolvedMode: "light" | "dark";
  setVariant: (variant: EchoThemeVariant) => void;
  setMode: (mode: EchoThemeMode) => void;
  setTheme: (preferences: Partial<EchoThemePreferences>) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemMode(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredPreferences(): EchoThemePreferences {
  if (typeof window === "undefined") {
    return defaultEchoTheme;
  }

  try {
    const stored = window.localStorage.getItem(ECHO_THEME_STORAGE_KEY);
    return stored ? normalizeThemePreferences(JSON.parse(stored)) : defaultEchoTheme;
  } catch {
    return defaultEchoTheme;
  }
}

function persistPreferences(preferences: EchoThemePreferences) {
  try {
    window.localStorage.setItem(ECHO_THEME_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage may be disabled or full; the applied DOM theme still works for the session.
  }
}

function applyPreferences(preferences: EchoThemePreferences, resolvedMode: "light" | "dark") {
  const root = document.documentElement;
  const isDarkPresentation = resolvedMode === "dark" || preferences.variant === "echo-night";

  root.dataset.echoTheme = preferences.variant;
  root.dataset.echoMode = preferences.mode;
  root.classList.toggle("dark", isDarkPresentation);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<EchoThemePreferences>(defaultEchoTheme);
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const nextPreferences = getStoredPreferences();
    const nextResolvedMode = nextPreferences.mode === "system" ? getSystemMode() : nextPreferences.mode;

    setPreferences(nextPreferences);
    setResolvedMode(nextResolvedMode);
    applyPreferences(nextPreferences, nextResolvedMode);
  }, []);

  useEffect(() => {
    if (preferences.mode !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const nextResolvedMode = getSystemMode();
      setResolvedMode(nextResolvedMode);
      applyPreferences(preferences, nextResolvedMode);
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [preferences]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== ECHO_THEME_STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        const nextPreferences = normalizeThemePreferences(JSON.parse(event.newValue));
        const nextResolvedMode =
          nextPreferences.mode === "system" ? getSystemMode() : nextPreferences.mode;

        setPreferences(nextPreferences);
        setResolvedMode(nextResolvedMode);
        applyPreferences(nextPreferences, nextResolvedMode);
      } catch {
        // Ignore malformed external writes.
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setTheme = useCallback((next: Partial<EchoThemePreferences>) => {
    setPreferences((current) => {
      const merged = normalizeThemePreferences({ ...current, ...next });
      const nextResolvedMode = merged.mode === "system" ? getSystemMode() : merged.mode;

      setResolvedMode(nextResolvedMode);
      applyPreferences(merged, nextResolvedMode);
      persistPreferences(merged);

      return merged;
    });
  }, []);

  const setVariant = useCallback(
    (variant: EchoThemeVariant) => {
      if (isEchoThemeVariant(variant)) {
        setTheme({ variant });
      }
    },
    [setTheme],
  );

  const setMode = useCallback(
    (mode: EchoThemeMode) => {
      if (isEchoThemeMode(mode)) {
        setTheme({ mode });
      }
    },
    [setTheme],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...preferences,
      resolvedMode: preferences.variant === "echo-night" ? "dark" : resolvedMode,
      setVariant,
      setMode,
      setTheme,
    }),
    [preferences, resolvedMode, setMode, setTheme, setVariant],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useEchoTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useEchoTheme must be used inside ThemeProvider");
  }

  return context;
}
