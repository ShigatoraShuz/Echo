import { describe, expect, it, vi } from "vitest";
import {
  createEncryptionService,
  decryptText,
  encryptText,
} from "../../src/infrastructure/encryption/encryption.service.js";
import {
  migrateAssessments,
  type AssessmentMigrationRow,
} from "../../src/infrastructure/encryption/wellness-migration.js";
const oldKey = Buffer.alloc(32, 6).toString("base64");
const old = createEncryptionService(oldKey, 1);
const current = createEncryptionService(Buffer.alloc(32, 7).toString("base64"), 2, { "1": oldKey });
const row: AssessmentMigrationRow = {
  id: "1",
  user_id: "owner",
  submission_id: "72000000-0000-4000-8000-000000000001",
  assessment_ciphertext: null,
  responses: [1, 1, 1, 1, 1, 1, 1, 1],
  score: 8,
  severity: "mild",
};
const payload = {
  format: "echo-phq8-v1",
  userId: row.user_id,
  submissionId: row.submission_id,
  responses: row.responses,
  score: row.score,
  severity: row.severity,
};
function store(value = row) {
  return {
    page: vi.fn().mockResolvedValueOnce([value]).mockResolvedValue([]),
    replace: vi.fn().mockResolvedValue(true),
  };
}
function sealed(ciphertext: string): AssessmentMigrationRow {
  return { ...row, assessment_ciphertext: ciphertext, responses: null, score: null, severity: null };
}
describe("assessment encryption backfill", () => {
  it("defaults to a dry run with counts and no sensitive values", async () => {
    const db = store();
    expect(await migrateAssessments(db, current, 2)).toEqual({
      scanned: 1,
      unchanged: 0,
      needsMigration: 1,
      updated: 0,
      conflicts: 0,
      unreadable: 0,
    });
    expect(db.replace).not.toHaveBeenCalled();
  });
  it("encrypts historical assessments and rotates approved old keys", async () => {
    for (const value of [row, sealed(encryptText(JSON.stringify(payload), old))]) {
      const db = store(value);
      expect(await migrateAssessments(db, current, 2, true)).toMatchObject({ updated: 1, unreadable: 0 });
      expect(db.replace.mock.calls[0][0]).toEqual(value);
      expect(JSON.parse(decryptText(db.replace.mock.calls[0][1], current))).toEqual(payload);
    }
  });
  it("skips already migrated records after validating integrity", async () => {
    const db = store(sealed(encryptText(JSON.stringify(payload), current)));
    expect(await migrateAssessments(db, current, 2, true)).toMatchObject({ unchanged: 1, updated: 0 });
    expect(db.replace).not.toHaveBeenCalled();
  });
  it.each([
    { ...row, score: 9 },
    { ...row, responses: [9] },
    sealed("echo:encrypted:v1:bad"),
    sealed(encryptText(JSON.stringify({ ...payload, userId: "other" }), old)),
    { ...sealed(encryptText(JSON.stringify(payload), current)), responses: row.responses },
  ])("does not overwrite corrupt, mixed, or cross-owner records", async (value) => {
    const db = store(value);
    expect(await migrateAssessments(db, current, 2, true)).toMatchObject({ unreadable: 1, updated: 0 });
    expect(db.replace).not.toHaveBeenCalled();
  });
  it("reports concurrent changes instead of overwriting", async () => {
    const db = store();
    db.replace.mockResolvedValue(false);
    expect(await migrateAssessments(db, current, 2, true)).toMatchObject({ conflicts: 1, updated: 0 });
  });
});
