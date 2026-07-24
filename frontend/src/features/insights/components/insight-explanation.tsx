"use client";

interface InsightExplanationProps {
  riskBand?: string;
  emotionCount?: number;
  hasData: boolean;
}

function getExplanation(hasData: boolean, riskBand?: string, emotionCount?: number): string {
  if (!hasData) return "Start journaling to see personalized insights about your emotional patterns.";
  if (riskBand === "high" || riskBand === "critical") return "Your recent entries suggest elevated distress. Consider reaching out to a trusted person or professional for support.";
  if (emotionCount !== undefined && emotionCount > 5) return "You are identifying a rich range of emotions, which supports self-awareness and emotional processing.";
  return "Your emotional patterns are forming. Continue journaling to discover deeper trends over time.";
}

export function InsightExplanation({ riskBand, emotionCount, hasData }: InsightExplanationProps) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-primary/[0.03] p-5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">What this means</p>
      <p className="mt-2 text-sm leading-6 text-foreground">{getExplanation(hasData, riskBand, emotionCount)}</p>
      <p className="mt-3 text-xs text-muted-foreground">ECHO insights are reflective observations, not clinical diagnoses. Always consult a professional for mental health concerns.</p>
    </div>
  );
}
