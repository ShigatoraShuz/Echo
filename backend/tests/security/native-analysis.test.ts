import { it, expect } from "vitest";
import fixture from "../../../packages/contracts/fixtures/core-v2.json";
import { journalAnalysisResultSchema } from "@echo/contracts";
import { createEncryptionService } from "../../src/infrastructure/encryption/encryption.service.js";
import { sealAnalysisResult, openAnalysisResult } from "../../src/infrastructure/encryption/analysis-result-encryption.js";

it("round-trips native labels with no invented severity or questionnaire score", () => {
  const encryption=createEncryptionService(Buffer.alloc(32,7).toString("base64"),1);
  const sealed=sealAnalysisResult(fixture,encryption);
  expect(sealed.supportSeverity).toBeNull();
  expect(openAnalysisResult({ciphertext:sealed.encryptedPayload},encryption)).toEqual(fixture);
  expect(JSON.stringify(sealed)).not.toContain("categoryScores");
});
it("rejects native outputs with fabricated severity or invalid distributions", () => {
  expect(journalAnalysisResultSchema.safeParse({...fixture,distressBand:"low"}).success).toBe(false);
  expect(journalAnalysisResultSchema.safeParse({...fixture,depressiveSymptomRange:{lower:0,upper:4}}).success).toBe(false);
  expect(journalAnalysisResultSchema.safeParse({...fixture,categoryScores:{...fixture.categoryScores,Others:2}}).success).toBe(false);
});
