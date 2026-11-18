"use client";
import { useState } from "react";
import { useAnalysisWording } from "@/shared/hooks/use-analysis-wording";
export function AnalysisWordingControls() {
  const { gentle, setGentle } = useAnalysisWording();
  const [error, setError] = useState("");
  return (
    <div className="mt-5 rounded-2xl border border-border bg-card/70 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">Analysis wording</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Choose the language that feels more comfortable.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-label="Use gentler analysis wording"
          aria-checked={gentle}
          onClick={() => setError(setGentle(!gentle) ? "" : "Could not save this preference.")}
          className={`relative h-7 w-12 shrink-0 rounded-full outline-none focus-visible:ring-4 focus-visible:ring-ring/20 ${gentle ? "bg-primary" : "bg-muted-foreground/40"}`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${gentle ? "left-1 translate-x-5" : "left-1"}`}
          />
        </button>
      </div>
      <p className="mt-3 text-sm font-semibold text-primary">{gentle ? "Cloudy days" : "Depressed / Depression"}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        On: Cloudy days. Off: original analysis labels. This changes display wording only; saved model outputs and
        scores stay the same. Saved on this device.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
