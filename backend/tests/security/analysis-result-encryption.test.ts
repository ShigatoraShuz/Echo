import { describe,it,expect } from "vitest";
import { sealAnalysisResult,openAnalysisResult } from "../../src/infrastructure/encryption/analysis-result-encryption.js";
import { createEncryptionService } from "../../src/infrastructure/encryption/encryption.service.js";
const encryption=createEncryptionService(Buffer.alloc(32,4).toString("base64"),1);
const result={schemaVersion:"echo-journal-analysis-v1",thresholdVersion:"echo-thresholds-v1",providerName:"synthetic-provider",modelVersion:"fixture-v1",isSimulated:true,emotionDistribution:[{emotion:"joy",value:0.1},{emotion:"calm",value:0.5},{emotion:"sadness",value:0.1},{emotion:"anxiety",value:0.1},{emotion:"anger",value:0.1},{emotion:"hope",value:0.1}],dominantEmotion:"calm",emotionConfidence:0.8,distressBand:"low",distressConfidence:0.8,depressiveSymptomRange:{lower:0,upper:4},recommendationFeatures:["paced_breathing"],facialExpressionAnalysis:null};
describe("analysis result encryption",()=>{
 it("round-trips structured results and removes raw result content from persistence parameters",()=>{
  const sealed=sealAnalysisResult(result,encryption);
  expect(openAnalysisResult({ciphertext:sealed.encryptedPayload},encryption)).toEqual(result);
  expect(JSON.stringify(sealed)).not.toMatch(/emotionDistribution|dominantEmotion|depressiveSymptomRange|distressConfidence/);
  expect(sealed.supportSeverity).toBe("minimal");
  expect(sealAnalysisResult(result,encryption).encryptedPayload).not.toBe(sealed.encryptedPayload);
 });
 it("rejects plaintext fallback, invalid outputs and wrong keys",()=>{
  expect(()=>openAnalysisResult(result,encryption)).toThrow();
  expect(()=>sealAnalysisResult({...result,role:"admin"},encryption)).toThrow();
  const sealed=sealAnalysisResult(result,encryption);
  expect(()=>openAnalysisResult({ciphertext:sealed.encryptedPayload},createEncryptionService(Buffer.alloc(32,5).toString("base64"),1))).toThrow();
 });
});
