import type { AnalysisStatus } from "@echo/contracts";
import { ConflictError } from "../../shared/errors/app-error.js";

export const terminalAnalysisStates = new Set<AnalysisStatus>(["completed", "failed"]);
const transitions: Record<AnalysisStatus, readonly AnalysisStatus[]> = {
  queued: ["safety_checking", "waiting_for_provider", "retrying", "failed"],
  waiting_for_provider: ["queued", "failed"],
  safety_checking: ["safety_action_required", "analyzing_emotions", "retrying", "failed"],
  safety_action_required: ["analyzing_emotions", "failed"],
  analyzing_emotions: ["classifying_distress", "retrying", "failed"],
  classifying_distress: ["estimating_screening", "retrying", "failed"],
  estimating_screening: ["generating_recommendation", "retrying", "failed"],
  generating_recommendation: ["aggregating_week", "retrying", "failed"],
  aggregating_week: ["completed", "retrying", "failed"],
  retrying: ["queued", "failed"],
  completed: [],
  failed: [],
};

export function assertAnalysisTransition(
  from: AnalysisStatus,
  to: AnalysisStatus,
  options: { reviewedSafety?: boolean; currentGatesChecked?: boolean; attemptAllowed?: boolean } = {},
): void {
  if (terminalAnalysisStates.has(from))
    throw new ConflictError("ANALYSIS_JOB_TERMINAL", "A terminal analysis job cannot be changed.");
  if (from === to) return;
  if (!transitions[from].includes(to))
    throw new ConflictError("INVALID_ANALYSIS_TRANSITION", "The analysis transition is not allowed.");
  if (from === "safety_action_required" && !options.reviewedSafety)
    throw new ConflictError("SAFETY_REVIEW_REQUIRED", "A reviewed safety decision is required.");
  if (from === "waiting_for_provider" && to === "queued" && !options.currentGatesChecked)
    throw new ConflictError("ANALYSIS_GATES_REQUIRED", "Current analysis gates must be checked before requeueing.");
  if (from === "retrying" && to === "queued" && !options.attemptAllowed)
    throw new ConflictError("ANALYSIS_RETRY_EXHAUSTED", "No further analysis attempt is allowed.");
}

export function analysisProgressFor(status: AnalysisStatus, attempt: number, currentProgress = 0): number {
  if (status === "failed") return currentProgress;
  const stages: AnalysisStatus[] = [
    "safety_checking",
    "analyzing_emotions",
    "classifying_distress",
    "estimating_screening",
    "generating_recommendation",
    "aggregating_week",
  ];
  const values =
    attempt <= 1 ? [10, 25, 35, 45, 55, 65] : attempt === 2 ? [72, 76, 80, 84, 87, 90] : [93, 94, 95, 96, 97, 98];
  const index = stages.indexOf(status);
  const next =
    status === "completed" ? 100 : status === "retrying" ? (attempt <= 1 ? 70 : 92) : index >= 0 ? values[index] : 5;
  return Math.max(currentProgress, next);
}
