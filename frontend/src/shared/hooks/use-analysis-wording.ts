"use client";
import { useSyncExternalStore } from "react";
export const ANALYSIS_WORDING_KEY = "echo:analysis-wording";
export const ANALYSIS_WORDING_EVENT = "echo:analysis-wording-changed";
export function analysisWordingPreference() {
  try {
    return localStorage.getItem(ANALYSIS_WORDING_KEY) !== "original";
  } catch {
    return true;
  }
}
function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === null || event.key === ANALYSIS_WORDING_KEY) notify();
  };
  window.addEventListener(ANALYSIS_WORDING_EVENT, notify);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(ANALYSIS_WORDING_EVENT, notify);
    window.removeEventListener("storage", storage);
  };
}
export function formatAnalysisWording(value: string, gentle: boolean) {
  return gentle
    ? value
        .replace(/\bdepressive[- ]symptom/gi, "Cloudy days")
        .replace(/\b(?:depression|depressed|depressive)\b/gi, "Cloudy days")
    : value;
}
export function useAnalysisWording() {
  const gentle = useSyncExternalStore(subscribe, analysisWordingPreference, () => true);
  return {
    gentle,
    label: (value: string) => formatAnalysisWording(value, gentle),
    setGentle: (next: boolean) => {
      try {
        localStorage.setItem(ANALYSIS_WORDING_KEY, next ? "gentle" : "original");
        window.dispatchEvent(new Event(ANALYSIS_WORDING_EVENT));
        return true;
      } catch {
        return false;
      }
    },
  };
}
