"use client";
import { useEffect, useState } from "react";
import { getAnalysisHandoff } from "@/services/journal/analysis-actions";

export function BuddyAnalysisHandoff({ onChoose }: { onChoose: (prompt: string) => void }) {
  const [handoff, setHandoff] = useState<Awaited<ReturnType<typeof getAnalysisHandoff>> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("handoff");
    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return;
    let active = true;
    void getAnalysisHandoff(id)
      .then((data) => {
        if (active) setHandoff(data);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  if (error)
    return (
      <p role="status" className="echo-card">
        This recommendation has expired or is no longer available.
      </p>
    );
  if (!handoff) return null;
  return (
    <section className="echo-card" aria-label="Approved reflection activity">
      <h2 className="text-lg font-semibold">{handoff.recommendation.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{handoff.recommendation.description}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Your journal text was not shared with Buddy. Nothing is sent until you choose to send it.
      </p>
      <button
        type="button"
        className="echo-button mt-3 border border-border"
        onClick={() => onChoose(`I'd like to try this activity: ${handoff.recommendation.title}`)}
      >
        Use this activity
      </button>
    </section>
  );
}
