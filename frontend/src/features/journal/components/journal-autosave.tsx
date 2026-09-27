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
  persist: (data: unknown) => Promise<void>;
  debounceMs?: number;
}

export function useAutosave({ persist, debounceMs = 2000 }: UseAutosaveOptions) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback((data: unknown) => {
    setStatus("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        await persist(data);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, debounceMs);
  }, [persist, debounceMs]);

  useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, []);

  return { status, save };
}
