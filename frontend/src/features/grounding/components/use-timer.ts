"use client";
import { useState, useCallback, useRef } from "react";

interface TimerControls {
  state: "idle" | "running" | "paused" | "completed";
  elapsed: number;
  total: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

export function useTimer(total: number, onComplete?: () => void): TimerControls {
  const [state, setState] = useState<"idle" | "running" | "paused" | "completed">("idle");
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const start = useCallback(() => {
    setState("running");
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 100;
        if (next >= total) {
          clearTimer();
          setState("completed");
          onComplete?.();
          return total;
        }
        return next;
      });
    }, 100);
  }, [total, onComplete, clearTimer]);

  const pause = useCallback(() => {
    clearTimer();
    setState("paused");
  }, [clearTimer]);

  const resume = useCallback(() => {
    setState("running");
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 100;
        if (next >= total) {
          clearTimer();
          setState("completed");
          onComplete?.();
          return total;
        }
        return next;
      });
    }, 100);
  }, [total, onComplete, clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setElapsed(0);
    setState("idle");
  }, [clearTimer]);

  return { state, elapsed, total, start, pause, resume, reset };
}
