import { it, expect } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { facialExpressionResultSchema } from "@echo/contracts";
import { LocalAnalysisStore } from "../../src/infrastructure/analysis/local-analysis-store.js";
import { JournalService } from "../../src/features/journals/journals.service.js";
import {journalSourceIdentity} from '../../src/features/journals/journal-source-identity.js';
import {createEncryptionService,decryptText} from '../../src/infrastructure/encryption/encryption.service.js';
import {openAnalysisResult} from '../../src/infrastructure/encryption/analysis-result-encryption.js';
import fixture from "../../../packages/contracts/fixtures/core-v2.json";
const base = resolve("../runtime-cache/face-tests");
mkdirSync(base, { recursive: true });
const result = {
  schemaVersion: "echo-face-expression-v1",
  status: "available",
  experimental: true,
  prediction: "joy",
  scoreType: "uncalibrated_class_probability",
  classProbabilities: {
    joy: 0.125,
    trust: 0.125,
    fear: 0.125,
    surprise: 0.125,
    sadness: 0.125,
    disgust: 0.125,
    anger: 0.125,
    anticipation: 0.125,
  },
  quality: { warning_flags: "" },
  modelFingerprint: "a".repeat(64),
  inferenceVersion: "facemesh-1.6.0",
  generatedAt: new Date().toISOString(),
};

it("stores a separately validated face result, reopens it and isolates accounts", async () => {
  const dir = mkdtempSync(join(base, "face-"));
  let store = new LocalAnalysisStore(dir);await store.ready;
  const user = randomUUID(),
    journal = randomUUID();
  try {
    const job = await store.create(user, journal, "key", "hash");
    await store.set(user, job.id, "completed", 100, JSON.stringify(fixture));
    await store.setFace(user, job.id, "completed", result);
    expect(store.get(randomUUID(), job.id)).toBeUndefined();
    expect(JSON.parse(store.get(user, job.id)!.result_ciphertext!)).toEqual(fixture);
    const json = readFileSync(join(dir, user, "analysis", job.id + ".json"), "utf8");
    expect(json).not.toContain("image");
    expect(JSON.parse(json).face_result.prediction).toBe("joy");
    await store.close();
    store = new LocalAnalysisStore(dir);await store.ready;
    expect(store.get(user, job.id)?.face_result).toEqual(result);
    await expect(store.setFace(user, job.id, "completed", { ...result, classProbabilities: { joy: 1 } })).rejects.toThrow();
  } finally {
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

it("rejects uncalibrated scores relabeled as confidence and invalid distributions", () => {
  expect(facialExpressionResultSchema.safeParse({ ...result, scoreType: "confidence" }).success).toBe(false);
  expect(
    facialExpressionResultSchema.safeParse({ ...result, classProbabilities: { ...result.classProbabilities, joy: 1 } })
      .success,
  ).toBe(false);
});

it("requires both consent gates before accepting an image", async () => {
  const service: any = Object.create(JournalService.prototype);
  service.localResults = {};
  service.coreClient = {};
  service.get = async () => ({ body: "Synthetic" });
  service.assertAnalysisGates = async () => {};
  service.hasGlobalAnalysisConsent = async () => true;
  service.hasGlobalFacialConsent = async () => false;
  await expect(service.submitFace(randomUUID(), randomUUID(), Buffer.from("synthetic"))).rejects.toThrow(/consent/i);
});
it('compares an owned current text snapshot despite timestamp updates and refreshes only stale sources',async()=>{
 const dir=mkdtempSync(join(base,'source-'));const store=new LocalAnalysisStore(dir);await store.ready;
 const user=randomUUID(),journal=randomUUID();let body='Synthetic reflection.';
 try{
  const job=await store.create(user,journal,'source-key','source-request');
  const source=journalSourceIdentity(journal,body);
  await store.setSourceIdentity(user,job.id,source);
  await store.set(user,job.id,'completed',100,JSON.stringify(fixture));
  await store.setFace(user,job.id,'completed',result,source);
  const service:any=Object.create(JournalService.prototype);service.localResults=store;
  service.get=async(account:string)=>{if(account!==user)throw Error('Not owned');return {body,updated_at:'2030-01-01T00:00:00Z'};};
  service.hasGlobalAnalysisConsent=async()=>true;service.hasGlobalFacialConsent=async()=>true;
  expect((await service.faceStatus(user,journal)).comparison.status).not.toBe('unavailable');
  expect(JSON.stringify(await service.faceStatus(user,journal))).not.toContain(source);
  await expect(service.faceStatus(randomUUID(),journal)).rejects.toThrow('Not owned');
  body='Edited reflection.';
  expect((await service.faceStatus(user,journal)).comparison).toMatchObject({textState:'stale',faceState:'stale'});
  await store.setSourceIdentity(user,job.id,journalSourceIdentity(journal,body));
  expect((await service.faceStatus(user,journal)).comparison).toMatchObject({textState:'current',faceState:'stale'});
  await store.setFace(user,job.id,'completed',result,journalSourceIdentity(journal,body));
  expect((await service.faceStatus(user,journal)).comparison.status).not.toBe('unavailable');
  await store.refreshJournal(user,job.id);
  expect((store.get(user,job.id) as any).previousResults).toHaveLength(1);
  expect(store.get(user,job.id)?.result_ciphertext).toBeNull();
  expect(JSON.stringify(await store.exportAccount(user))).not.toContain('journal-text-v1:');
  service.hasGlobalFacialConsent=async()=>false;
  expect((await service.faceStatus(user,journal)).comparison.reason).toBe('consent_required');
 }finally{await store.close();rmSync(dir,{recursive:true,force:true});}
});
it('keeps hosted journal source identity encrypted and out of parsed model responses',()=>{
 const encryption=createEncryptionService(Buffer.alloc(32,9).toString('base64'),1);
 const service:any=Object.create(JournalService.prototype);service.encryption=encryption;
 const source=journalSourceIdentity(randomUUID(),'Synthetic reflection.');
 const sealed=service.encryptAnalysisResult(fixture,source);
 expect(JSON.parse(decryptText(sealed.encryptedPayload,encryption))._journalTextIdentity).toBe(source);
 expect(openAnalysisResult({ciphertext:sealed.encryptedPayload},encryption)).toEqual(fixture);
 expect(JSON.stringify(sealed)).not.toContain(source);
});
