import { it, expect } from "vitest";
import { journalScreeningSchema, journalAnalysisResultSchema } from "@echo/contracts";
const names = [
  "anhedonia",
  "depressed_mood",
  "sleep",
  "fatigue",
  "appetite",
  "worthlessness_guilt",
  "concentration",
  "psychomotor",
];
const items = Object.fromEntries(names.map((k) => [k, null]));
it("keeps nulls distinct from zero and validates partial subtotals", () => {
  const base = {
    status: "available",
    experimental: true,
    inferenceVersion: "journal-nullable-v1",
    items,
    coverage: 0,
    subtotal: null,
    total: null,
  };
  expect(journalScreeningSchema.safeParse(base).success).toBe(true);
  expect(
    journalScreeningSchema.safeParse({ ...base, items: { ...items, sleep: 0 }, coverage: 1, subtotal: 0 }).success,
  ).toBe(true);
  expect(journalScreeningSchema.safeParse({ ...base, items: { ...items, sleep: "null" } }).success).toBe(false);
  expect(journalScreeningSchema.safeParse({ ...base, items: { sleep: null } }).success).toBe(false);
  expect(journalScreeningSchema.safeParse({ ...base, subtotal: 0 }).success).toBe(false);
});

it("keeps v3 nullable estimates separate through encrypted persistence", async () => {
  const { default: fixture } = await import("../../../packages/contracts/fixtures/core-v2.json");
  const { createEncryptionService } = await import("../../src/infrastructure/encryption/encryption.service.js");
  const { sealAnalysisResult, openAnalysisResult } =
    await import("../../src/infrastructure/encryption/analysis-result-encryption.js");
  const result = journalAnalysisResultSchema.parse({
    ...fixture,
    schemaVersion: "echo-journal-analysis-v3",
    journalScreening: {
      status: "available",
      experimental: true,
      inferenceVersion: "test",
      items: { ...items, sleep: 2 },
      coverage: 1,
      subtotal: 2,
      total: null,
    },
  });
  const encryption = createEncryptionService(Buffer.alloc(32, 5).toString("base64"), 1);
  const sealed = sealAnalysisResult(result, encryption);
  expect(sealed.supportSeverity).toBeNull();
  expect(openAnalysisResult({ ciphertext: sealed.encryptedPayload }, encryption)).toEqual(result);
});
