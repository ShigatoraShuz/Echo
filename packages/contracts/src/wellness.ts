import { z } from "zod";

export const phq8ResponsesSchema = z.array(z.number().int().min(0).max(3)).length(8);
export const phq8SubmissionSchema = z
  .object({
    submissionId: z.string().uuid(),
    responses: phq8ResponsesSchema,
  })
  .strict();
export type Phq8Submission = z.infer<typeof phq8SubmissionSchema>;
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
  assessment: { due: boolean; dueAt: string | null; intervalDays: number; history: Phq8Assessment[] };
  support: { eligible: boolean; count: number; windowDays: number };
  urgentJournalId: string | null;
}
