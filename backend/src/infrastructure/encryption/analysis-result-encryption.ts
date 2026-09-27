import { journalAnalysisResultSchema, type JournalAnalysisResult } from "@echo/contracts";
import { encryptText,decryptText,type EncryptionService } from "./encryption.service.js";
export function sealAnalysisResult(value:unknown,encryption:EncryptionService) {
 const result=journalAnalysisResultSchema.parse(value);
 return {
  encryptedPayload:encryptText(JSON.stringify(result),encryption),
  schemaVersion:result.schemaVersion,thresholdVersion:result.thresholdVersion,
  providerName:result.providerName,modelVersion:result.modelVersion,isSimulated:result.isSimulated,
  recommendationFeatures:result.recommendationFeatures,
  // Minimal existing safety-prompt index; detailed scores/distributions remain encrypted.
  supportSeverity:result.distressBand==="low" ? "minimal" : result.distressBand==="high" ? "moderately_severe" : result.distressBand,
 };
}
export function openAnalysisResult(value:unknown,encryption:EncryptionService):JournalAnalysisResult {
 if(!value || typeof value!=="object" || !("ciphertext" in value)) throw new Error("Analysis ciphertext backfill required.");
 return journalAnalysisResultSchema.parse(JSON.parse(decryptText((value as {ciphertext:unknown}).ciphertext,encryption)));
}
