"use client";
import { useState } from "react";
import { MessageCircleHeart } from "lucide-react";
import { createAnalysisHandoff } from "@/services/journal/analysis-actions";

export function AnalysisBuddyAction({ resultId }: { resultId?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    if (!resultId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createAnalysisHandoff(resultId);
      window.location.assign(`/buddy?handoff=${encodeURIComponent(id)}`);
    } catch {
      setError("This recommendation could not be opened. Please try again.");
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy || !resultId}
        className="echo-button mt-5 bg-primary text-primary-foreground disabled:opacity-50"
      >
        <MessageCircleHeart className="h-4 w-4" aria-hidden="true" />
        {busy ? "Opening activity…" : "Start with ECHO Buddy"}
      </button>
      <p className="mt-2 text-xs text-muted-foreground">
        Only approved recommendation features are shared—not your journal text.
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-sm">
          {error}
        </p>
      ) : null}
    </>
  );
}
