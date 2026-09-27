import { phq8SubmissionSchema, scorePhq8 } from "@echo/contracts";
import { decryptText, encryptText, type EncryptionService } from "./encryption.service.js";
export interface AssessmentMigrationRow {
  id: string;
  user_id: string;
  submission_id: string;
  assessment_ciphertext: string | null;
  responses: number[] | null;
  score: number | null;
  severity: string | null;
}
export interface AssessmentMigrationStore {
  page(after: string | undefined): Promise<AssessmentMigrationRow[]>;
  replace(row: AssessmentMigrationRow, ciphertext: string): Promise<boolean>;
}
/** Counts only; all plaintext stays in process memory. Never repairs inconsistent historical scores silently. */
export async function migrateAssessments(
  store: AssessmentMigrationStore,
  encryption: EncryptionService,
  activeVersion: number,
  apply = false,
) {
  const result = { scanned: 0, unchanged: 0, needsMigration: 0, updated: 0, conflicts: 0, unreadable: 0 };
  let cursor: string | undefined;
  for (;;) {
    const rows = await store.page(cursor);
    if (!rows.length) break;
    for (const row of rows) {
      result.scanned++;
      try {
        let payload: Record<string, unknown>;
        if (row.assessment_ciphertext !== null) {
          payload = JSON.parse(decryptText(row.assessment_ciphertext, encryption)) as Record<string, unknown>;
          if (
            payload.format !== "echo-phq8-v1" ||
            payload.userId !== row.user_id ||
            payload.submissionId !== row.submission_id ||
            row.responses !== null ||
            row.score !== null ||
            row.severity !== null
          )
            throw new Error("Inconsistent assessment");
        } else {
          payload = {
            format: "echo-phq8-v1",
            userId: row.user_id,
            submissionId: row.submission_id,
            responses: row.responses,
            score: row.score,
            severity: row.severity,
          };
        }
        const parsed = phq8SubmissionSchema.parse({ submissionId: payload.submissionId, responses: payload.responses });
        const scored = scorePhq8(parsed.responses);
        if (scored.score !== payload.score || scored.severity !== payload.severity)
          throw new Error("Inconsistent score");
        if (row.assessment_ciphertext !== null) {
          const envelope = JSON.parse(
            Buffer.from(row.assessment_ciphertext.slice("echo:encrypted:v1:".length), "base64").toString("utf8"),
          ) as { keyVersion: number };
          if (envelope.keyVersion === activeVersion) {
            result.unchanged++;
            continue;
          }
        }
        result.needsMigration++;
        if (apply) {
          const plaintext = JSON.stringify(payload);
          const ciphertext = encryptText(plaintext, encryption);
          if (decryptText(ciphertext, encryption) !== plaintext) throw new Error("Round-trip failed");
          if (await store.replace(row, ciphertext)) result.updated++;
          else result.conflicts++;
        }
      } catch {
        result.unreadable++;
      }
    }
    const next = rows.at(-1)!.id;
    if (cursor !== undefined && next <= cursor) throw new Error("Migration pagination did not advance.");
    cursor = next;
  }
  return result;
}
