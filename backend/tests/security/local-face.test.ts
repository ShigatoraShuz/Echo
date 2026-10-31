import { it, expect } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { facialExpressionResultSchema } from "@echo/contracts";
import { LocalAnalysisStore } from "../../src/infrastructure/analysis/local-analysis-store.js";
import { JournalService } from "../../src/features/journals/journals.service.js";
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

it("stores a separately validated face result, reopens it and isolates accounts", () => {
  const dir = mkdtempSync(join(base, "face-"));
  let store = new LocalAnalysisStore(dir);
  const user = randomUUID(),
    journal = randomUUID();
  try {
    const job = store.create(user, journal, "key", "hash");
    store.set(user, job.id, "completed", 100, JSON.stringify(fixture));
    store.setFace(user, job.id, "completed", result);
    expect(store.get(randomUUID(), job.id)).toBeUndefined();
    expect(JSON.parse(store.get(user, job.id)!.result_ciphertext!)).toEqual(fixture);
    const json = readFileSync(join(dir, user, "analysis", job.id + ".json"), "utf8");
    expect(json).not.toContain("image");
    expect(JSON.parse(json).face_result.prediction).toBe("joy");
    store.close();
    store = new LocalAnalysisStore(dir);
    expect(store.get(user, job.id)?.face_result).toEqual(result);
    expect(() => store.setFace(user, job.id, "completed", { ...result, classProbabilities: { joy: 1 } })).toThrow();
  } finally {
    store.close();
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
