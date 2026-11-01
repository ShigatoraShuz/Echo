import type { DashboardInsights } from "@echo/contracts";
import { analysisRequestMessage } from "../model/analysis-summary";

export function AnalysisRequestStatus({ insights }: { insights?: DashboardInsights | null }) {
  const message = analysisRequestMessage(insights);
  return message ? <p role="status" className="rounded-xl border border-border bg-secondary/40 p-3 text-sm leading-6 text-foreground/80">{message}</p> : null;
}
