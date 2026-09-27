import {
  decryptText,
  encryptText,
  type EncryptionService,
} from "../../infrastructure/encryption/encryption.service.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  phq8SubmissionSchema,
  scorePhq8,
  type Phq8Assessment,
  type Phq8Submission,
  type WellnessStatus,
} from "@echo/contracts";
import { ConflictError, ExternalServiceError, ValidationError } from "../../shared/errors/app-error.js";

export interface WellnessSchedule {
  phq8IntervalDays: number;
  supportThreshold: number;
  supportWindowDays: number;
  supportCooldownDays: number;
}
export const defaultWellnessSchedule: WellnessSchedule = {
  phq8IntervalDays: 7,
  supportThreshold: 3,
  supportWindowDays: 14,
  supportCooldownDays: 7,
};
export function assessmentDueAt(completedAt: string | null, intervalDays: number): string | null {
  return completedAt ? new Date(Date.parse(completedAt) + intervalDays * 86_400_000).toISOString() : null;
}
export function isAssessmentDue(completedAt: string | null, intervalDays: number, now = Date.now()): boolean {
  const dueAt = assessmentDueAt(completedAt, intervalDays);
  return dueAt === null || Date.parse(dueAt) <= now;
}
const unavailable = () =>
  new ExternalServiceError("DATABASE_UNAVAILABLE", "Your check-in could not be loaded. Please try again.");
export class WellnessService {
  constructor(
    private readonly database: SupabaseClient,
    private readonly schedule: WellnessSchedule = defaultWellnessSchedule,
    private readonly encryption?: EncryptionService,
  ) {}
  private openAssessment(row: Record<string, unknown>, userId: string) {
    if (!this.encryption) throw unavailable();
    try {
      const payload = JSON.parse(decryptText(row.assessment_ciphertext, this.encryption)) as Record<string, unknown>;
      if (payload.format !== "echo-phq8-v1" || payload.userId !== userId || payload.submissionId !== row.submission_id)
        throw unavailable();
      const calculated = scorePhq8(payload.responses as number[]);
      if (payload.score !== calculated.score || payload.severity !== calculated.severity) throw unavailable();
      return {
        responses: payload.responses as number[],
        assessment: { id: String(row.id), ...calculated, completedAt: String(row.completed_at) },
      };
    } catch {
      throw unavailable();
    }
  }

  async status(userId: string): Promise<WellnessStatus> {
    const [history, count, state, urgent] = await Promise.all([
      this.database
        .schema("insights_service")
        .from("phq8_assessments")
        .select("id,user_id,submission_id,assessment_ciphertext,completed_at")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false })
        .limit(52),
      this.database
        .schema("insights_service")
        .rpc("recent_concerning_journals", { p_user_id: userId, p_window_days: this.schedule.supportWindowDays }),
      this.database
        .schema("insights_service")
        .from("support_prompt_state")
        .select("last_prompted_at")
        .eq("user_id", userId)
        .maybeSingle(),
      this.database
        .schema("ai_analysis")
        .from("analysis_requests")
        .select("journal_id")
        .eq("user_id", userId)
        .eq("status", "safety_action_required")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if ([history, count, state, urgent].some((result) => result.error)) throw unavailable();
    const records = (history.data ?? []).map((row) => this.openAssessment(row, userId).assessment);
    const completedAt = records[0]?.completedAt ?? null;
    return {
      assessment: {
        due: isAssessmentDue(completedAt, this.schedule.phq8IntervalDays),
        dueAt: assessmentDueAt(completedAt, this.schedule.phq8IntervalDays),
        intervalDays: this.schedule.phq8IntervalDays,
        history: records,
      },
      support: {
        eligible:
          !urgent.data &&
          Number(count.data) >= this.schedule.supportThreshold &&
          isAssessmentDue(state.data?.last_prompted_at ?? null, this.schedule.supportCooldownDays),
        count: Number(count.data),
        windowDays: this.schedule.supportWindowDays,
      },
      urgentJournalId: urgent.data?.journal_id ?? null,
    };
  }
  async save(userId: string, input: Phq8Submission): Promise<Phq8Assessment> {
    const parsed = phq8SubmissionSchema.safeParse(input);
    if (!parsed.success)
      throw new ValidationError({ responses: ["Answer all eight questions using the available choices."] });
    if (!this.encryption) throw unavailable();
    const ciphertext = encryptText(
      JSON.stringify({ format: "echo-phq8-v1", userId, ...parsed.data, ...scorePhq8(parsed.data.responses) }),
      this.encryption,
    );
    const { data, error } = await this.database.schema("insights_service").rpc("save_encrypted_phq8", {
      p_user_id: userId,
      p_submission_id: parsed.data.submissionId,
      p_ciphertext: ciphertext,
      p_interval_days: this.schedule.phq8IntervalDays,
    });
    if (error || !data) throw unavailable();
    const opened = this.openAssessment(data, userId);
    if (
      data.submission_id === parsed.data.submissionId &&
      JSON.stringify(opened.responses) !== JSON.stringify(parsed.data.responses)
    )
      throw new ConflictError("SUBMISSION_CONFLICT", "This check-in was already submitted with different answers.");
    return opened.assessment;
  }
  async claimSupportPrompt(userId: string): Promise<{ show: boolean }> {
    const { data, error } = await this.database.schema("insights_service").rpc("claim_support_prompt", {
      p_user_id: userId,
      p_threshold: this.schedule.supportThreshold,
      p_window_days: this.schedule.supportWindowDays,
      p_cooldown_days: this.schedule.supportCooldownDays,
    });
    if (error) throw unavailable();
    return { show: data === true };
  }
}
