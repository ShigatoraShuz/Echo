import { Bot } from "lucide-react";
import type { JournalAnalysis } from "../model/journal.model";

interface JournalAnalysisPanelProps {
  analysis: JournalAnalysis | null;
  isLoading?: boolean;
  canAnalyze?: boolean;
  error?: string | null;
  onAnalyze?: () => void;
}

export function JournalAnalysisPanel({ analysis, isLoading, canAnalyze = false, error, onAnalyze }: JournalAnalysisPanelProps) {
  if (isLoading || analysis?.status === "processing" || analysis?.status === "pending") {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-subtle">
        <h3 className="text-base font-semibold text-foreground">ECHO perspective</h3>
        <p className="mt-2 text-sm text-muted-foreground animate-pulse">Preparing reflection summary...</p>
        {!isLoading && <p className="mt-2 text-xs text-muted-foreground">Refresh this page to check the result. Your journal remains saved.</p>}
      </div>
    );
  }

  if (!analysis || analysis.status === "failed") {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-subtle">
        <h3 className="text-base font-semibold text-foreground">ECHO perspective</h3>
        {analysis?.status === "failed" && <p role="status" className="mt-2 text-sm">Analysis could not be completed. Your reflection remains saved. You can retry when the service is available.</p>}
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {canAnalyze
            ? "Request an ECHO perspective when you are ready. Analysis uses the consent saved with this reflection."
            : "Enable analysis consent while editing this reflection before requesting an ECHO perspective."}
        </p>
        {canAnalyze && onAnalyze && (
          <button type="button" onClick={onAnalyze} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Analyze reflection
          </button>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        <p className="mt-3 text-xs text-muted-foreground">ECHO is not a diagnostic tool. If validated ML is unavailable, your reflection remains saved and usable.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-subtle">
      <h3 className="text-base font-semibold text-foreground">ECHO perspective</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        A reflective summary, not clinical interpretation.
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 flex gap-3 rounded-xl border border-border/70 bg-background p-4">
        <Bot className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>{analysis.perspective}</p>
          <p className="text-xs italic">
            {analysis.isDemoData ? "Demonstration analysis. ECHO is not a diagnostic tool." : ""}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-background p-3">
          <p className="text-xs font-medium text-muted-foreground">Mood insight</p>
          <p className="mt-1 text-sm text-foreground">{analysis.moodInsight}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background p-3">
          <p className="text-xs font-medium text-muted-foreground">Risk indication</p>
          <p className="mt-1 text-sm text-foreground">{analysis.riskIndication}</p>
        </div>
      </div>
    </div>
  );
}
