"use client";
import { useEffect, useRef } from "react";
/** Visible-only, bounded freshness; a cleared session cannot restart this observer. */
export function useWorkspaceRefresh(refresh: () => void, scope: string, clear?: () => void, interval = 60_000) {
  const latest = useRef({ refresh, clear });
  useEffect(() => {
    latest.current = { refresh, clear };
  });
  useEffect(() => {
    if (!scope) return;
    let stopped = false,
      last = 0;
    const run = () => {
      if (stopped || document.visibilityState === "hidden" || Date.now() - last < 1000) return;
      last = Date.now();
      latest.current.refresh();
    };
    const mutation = () => {
      last = 0;
      run();
    };
    const stop = () => {
      stopped = true;
      latest.current.clear?.();
      window.clearInterval(timer);
    };
    const timer = window.setInterval(run, Math.max(30_000, interval));
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);
    window.addEventListener("echo:appointments-changed", mutation);
    window.addEventListener("echo:notifications-changed", run);
    window.addEventListener("echo:sensitive-state-cleared", stop);
    window.addEventListener("echo:professional-access-lost", stop);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("echo:appointments-changed", mutation);
      window.removeEventListener("echo:notifications-changed", run);
      window.removeEventListener("echo:sensitive-state-cleared", stop);
      window.removeEventListener("echo:professional-access-lost", stop);
    };
  }, [scope, interval]);
}
export function appointmentsChanged() {
  window.dispatchEvent(new Event("echo:appointments-changed"));
  window.dispatchEvent(new Event("echo:notifications-changed"));
}
