import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { shouldReduceMotion } from "@/shared/hooks/use-prefers-reduced-motion";
import { MotionPreferenceSelect, ThemeControls } from "./theme-controls";
import { ThemeProvider } from "./theme-provider";
import { ECHO_THEME_STORAGE_KEY, normalizeThemePreferences } from "./theme";

vi.mock("@/features/journal/components/analysis-status-experience", () => ({ AnalysisStatusExperience: () => null }));
vi.mock("@/features/journal/components/analysis-completion-toast", () => ({ AnalysisCompletionToast: () => null }));

describe("ECHO motion preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.echoMotion = "system";
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("defaults to the device preference and rejects an invalid saved value", () => {
    expect(normalizeThemePreferences({ motion: "invalid" }).motion).toBe("system");
    expect(shouldReduceMotion()).toBe(true);
  });

  it("saves a browser-local override and can return to the device preference", async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><MotionPreferenceSelect /></ThemeProvider>);

    await user.click(screen.getByRole("button", { name: "Play animations" }));
    expect(document.documentElement.dataset.echoMotion).toBe("full");
    expect(shouldReduceMotion()).toBe(false);
    expect(JSON.parse(window.localStorage.getItem(ECHO_THEME_STORAGE_KEY) ?? "{}").motion).toBe("full");

    await user.click(screen.getByRole("button", { name: "Follow device" }));
    expect(document.documentElement.dataset.echoMotion).toBe("system");
    expect(shouldReduceMotion()).toBe(true);
  });

  it("switches all four theme tiles and display modes", async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><ThemeControls compact /></ThemeProvider>);

    for (const [label, variant] of [["Calm", "echo-calm"], ["Night", "echo-night"], ["Soft", "echo-soft"], ["Focus", "echo-focus"]]) {
      await user.click(screen.getByRole("button", { name: label }));
      expect(document.documentElement.dataset.echoTheme).toBe(variant);
      expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
    }
    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(document.documentElement.dataset.echoMode).toBe("dark");
    await user.click(screen.getByRole("button", { name: "System" }));
    expect(document.documentElement.dataset.echoMode).toBe("system");
  });
});
