"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Save, Cloud, AlertCircle } from "lucide-react";

type AutosaveStatus = "idle" | "saving" | "saved" | "error";

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
}

export function JournalAutosaveIndicator({ status }: AutosaveIndicatorProps) {
  if (status === "idle") return null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {status === "saving" && <><Cloud className="h-3 w-3 animate-pulse" /> Saving...</>}
      {status === "saved" && <><Save className="h-3 w-3 text-success" /> Saved</>}
      {status === "error" && <><AlertCircle className="h-3 w-3 text-danger" /> Save failed</>}
    </div>
  );
}

interface UseAutosaveOptions {
  key: string;
  debounceMs?: number;
}

export function useAutosave({ key, debounceMs = 2000 }: UseAutosaveOptions) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback((data: unknown) => {
    setStatus("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2000);
      } catch {
        setStatus("error");
      }
    }, debounceMs);
  }, [key, debounceMs]);

  const load = useCallback(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  }, [key]);

  useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, []);

  return { status, save, load };
}
