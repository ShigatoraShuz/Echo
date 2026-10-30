import { z } from "zod";

export const phq8ResponsesSchema = z.array(z.number().int().min(0).max(3)).length(8);
export const phq8SubmissionSchema = z
  .object({
    submissionId: z.string().uuid(),
    responses: phq8ResponsesSchema,
  })
  .strict();
export type Phq8Submission = z.infer<typeof phq8SubmissionSchema>;
export const selfReportedPhq8SubmissionSchema = z.object({
  submissionId: z.string().uuid(),
  responses: z.array(z.number().int().min(0).max(3).nullable()).length(8),
}).strict();
export type SelfReportedPhq8Submission = z.infer<typeof selfReportedPhq8SubmissionSchema>;
export function summarizeSelfReportedPhq8(input: Array<number | null>) {
  const responses = selfReportedPhq8SubmissionSchema.shape.responses.parse(input);
  const answered = responses.filter((n): n is number => n !== null);
  const subtotal = answered.reduce((sum, n) => sum + n, 0);
  return { responses, scored_symptom_count: answered.length, subtotal, complete: answered.length === 8,
    total: answered.length === 8 ? subtotal : null, source: "SELF_REPORTED_PHQ8" as const,
    executionState: "DEMO_FALLBACK" as const };
}
export type SelfReportedPhq8 = ReturnType<typeof summarizeSelfReportedPhq8> & { id: string; completedAt: string };
export type Phq8Severity = "minimal" | "mild" | "moderate" | "moderately_severe" | "severe";
export function scorePhq8(responses: number[]): { score: number; severity: Phq8Severity } {
  const score = phq8ResponsesSchema.parse(responses).reduce((sum, answer) => sum + answer, 0);
  const severity =
    score < 5 ? "minimal" : score < 10 ? "mild" : score < 15 ? "moderate" : score < 20 ? "moderately_severe" : "severe";
  return { score, severity };
}
export interface Phq8Assessment {
  id: string;
  score: number;
  severity: Phq8Severity;
  completedAt: string;
}
export interface WellnessStatus {
  assessment: { due: boolean; dueAt: string | null; intervalDays: number; history: Phq8Assessment[]; selfReports?: SelfReportedPhq8[] };
  support: { eligible: boolean; count: number; windowDays: number };
  urgentJournalId: string | null;
}
