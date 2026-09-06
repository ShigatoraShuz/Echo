import { createCipheriv, randomBytes } from "node:crypto";
import type { OwnedDatabase } from "@echo/service-core";
import { ServiceError } from "@echo/service-core";
const bytea = (value: Buffer) => `\\x${value.toString("hex")}`;
export function phq8(answers: number[]) {
  if (answers.length !== 8 || answers.some((value) => !Number.isInteger(value) || value < 0 || value > 3))
    throw new ServiceError(400, "VALIDATION_ERROR", "PHQ-8 requires eight answers from 0 to 3.");
  const score = answers.reduce((sum, value) => sum + value, 0);
  const severity =
    score <= 4
      ? "minimal"
      : score <= 9
        ? "mild"
        : score <= 14
          ? "moderate"
          : score <= 19
            ? "moderately_severe"
            : "severe";
  return {
    score,
    severity,
    disclaimer: "This screening result is not a diagnosis. Contact a qualified professional for clinical advice.",
  };
}
export class AssessmentService {
  constructor(
    private database: OwnedDatabase,
    private key: Buffer,
    private keyVersion: number,
    private intervalDays = 7,
  ) {
    if (key.length !== 32) throw new Error("JOURNAL_ENCRYPTION_KEY_BASE64 must decode to 32 bytes.");
  }
  async history(userId: string) {
    const { data, error } = await this.database
      .from("phq8_assessments")
      .select("id,answers,score,severity,completed_at")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(100);
    if (error) throw new ServiceError(503, "DATABASE_UNAVAILABLE", "Assessment history could not be loaded.");
    return data ?? [];
  }
  async status(userId: string, now = new Date()) {
    const latest = (await this.history(userId))[0];
    const nextDueAt = latest
      ? new Date(new Date(latest.completed_at).getTime() + this.intervalDays * 86400000).toISOString()
      : null;
    return {
      due: !nextDueAt || now.getTime() >= Date.parse(nextDueAt),
      lastCompletedAt: latest?.completed_at ?? null,
      nextDueAt,
      intervalDays: this.intervalDays,
    };
  }
  async submit(userId: string, answers: number[]) {
    const result = phq8(answers);
    const { data, error } = await this.database
      .from("phq8_assessments")
      .insert({ user_id: userId, answers, score: result.score, severity: result.severity })
      .select("id,answers,score,severity,completed_at")
      .single();
    if (error || !data)
      throw new ServiceError(503, "DATABASE_UNAVAILABLE", "Your assessment could not be saved. Please try again.");
    return { ...data, disclaimer: result.disclaimer };
  }
  async recordMood(
    userId: string,
    input: { moodScore: number; energyScore?: number; anxietyScore?: number; note?: string },
  ) {
    let protectedNote = {};
    if (input.note) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", this.key, iv);
      const encrypted = Buffer.concat([cipher.update(input.note, "utf8"), cipher.final()]);
      protectedNote = {
        note: null,
        note_ciphertext: bytea(encrypted),
        encryption_iv: bytea(iv),
        encryption_auth_tag: bytea(cipher.getAuthTag()),
        encryption_key_version: this.keyVersion,
      };
    }
    const { data, error } = await this.database
      .from("mood_entries")
      .insert({
        user_id: userId,
        mood_score: input.moodScore,
        energy_score: input.energyScore,
        anxiety_score: input.anxietyScore,
        ...protectedNote,
      })
      .select("id, mood_score, energy_score, anxiety_score, recorded_at, created_at")
      .single();
    if (error || !data) throw new ServiceError(503, "DATABASE_UNAVAILABLE", "The mood entry could not be saved.");
    return data;
  }
  async listMoods(userId: string) {
    const { data, error } = await this.database
      .from("mood_entries")
      .select("id, mood_score, energy_score, anxiety_score, recorded_at, created_at")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(90);
    if (error) throw new ServiceError(503, "DATABASE_UNAVAILABLE", "Mood entries could not be loaded.");
    return data ?? [];
  }
}
