import { Bot } from "lucide-react";
import type { JournalAnalysis } from "../model/journal.model";

interface JournalAnalysisPanelProps {
  analysis: JournalAnalysis | null;
  isLoading?: boolean;
}

export function JournalAnalysisPanel({ analysis, isLoading }: JournalAnalysisPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-subtle">
        <h3 className="text-base font-semibold text-foreground">ECHO perspective</h3>
        <p className="mt-2 text-sm text-muted-foreground animate-pulse">Preparing reflection summary...</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-subtle">
        <h3 className="text-base font-semibold text-foreground">ECHO perspective</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Analysis will appear here when available. ECHO is not a diagnostic tool.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-subtle">
      <h3 className="text-base font-semibold text-foreground">ECHO perspective</h3>
      <p className="mt-1 text-xs text-muted-foreground">A reflective summary, not clinical interpretation.</p>
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
      {analysis.result ? (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <h4 className="font-semibold">Emotion distribution</h4>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {analysis.result.emotionDistribution.map((emotion) => (
              <li key={emotion.emotion} className="capitalize">
                {emotion.emotion}: {Math.round(emotion.value * 100)}%
              </li>
            ))}
          </ul>
          <p className="text-sm">
            AI-estimated depressive-symptom range: {analysis.result.depressiveSymptomRange.lower}–
            {analysis.result.depressiveSymptomRange.upper}
          </p>
          <p className="text-xs text-muted-foreground">
            This AI-generated estimate is not a diagnosis or completed PHQ-8 assessment.
          </p>
        </div>
      ) : null}
    </div>
  );
}
