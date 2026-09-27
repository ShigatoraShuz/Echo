import { describe, expect, it } from "vitest";
import { clearSensitiveBrowserState } from "./clear-sensitive-state";

describe("sensitive session cache cleanup", () => {
  it("removes old private caches from both storage areas and preserves UI preferences", () => {
    for (const storage of [localStorage, sessionStorage]) {
      storage.setItem("journal-draft", "synthetic private journal");
      storage.setItem("echo:active-analysis", "synthetic analysis metadata");
      storage.setItem("echo-theme", "dark");
    }
    clearSensitiveBrowserState();
    for (const storage of [localStorage, sessionStorage]) {
      expect(storage.getItem("journal-draft")).toBeNull();
      expect(storage.getItem("echo:active-analysis")).toBeNull();
      expect(storage.getItem("echo-theme")).toBe("dark");
    }
  });
});
