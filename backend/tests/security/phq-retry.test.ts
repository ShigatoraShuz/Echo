import { it, expect } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { JournalService } from "../../src/features/journals/journals.service.js";
import { LocalAnalysisStore } from "../../src/infrastructure/analysis/local-analysis-store.js";
import fixture from "../../../packages/contracts/fixtures/core-v2.json";
const base = resolve("../../runtime-cache/phq-retry-tests");
mkdirSync(base, { recursive: true });
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
const screening = {
  status: "available",
  experimental: true,
  inferenceVersion: "synthetic",
  items: Object.fromEntries(names.map((k) => [k, null])),
  coverage: 0,
  subtotal: null,
  total: null,
};
it("retries only screening, preserves native results and enforces the retry limit", async () => {
  const dir = mkdtempSync(join(base, "retry-")),
    store = new LocalAnalysisStore(dir),
    user = randomUUID(),
    journal = randomUUID();
  const job = store.create(user, journal, "key", "hash");
  store.set(user, job.id, "completed", 100, JSON.stringify(fixture));
  let calls = 0;
  const service: any = new JournalService(
    {} as any,
    {} as any,
    {} as any,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    store,
    {
      screening: async () => {
        calls++;
        return screening;
      },
      analyze: () => {
        throw Error("Must not rerun native models");
      },
    } as any,
  );
  service.get = async () => ({ body: "Synthetic journal" });
  service.assertAnalysisGates = async () => {};
  service.hasGlobalAnalysisConsent = async () => true;
  try {
    await service.retryScreening(user, journal);
    const result = JSON.parse(store.get(user, job.id)!.result_ciphertext!);
    expect(result.categoryScores).toEqual(fixture.categoryScores);
    expect(result.emotionDistribution).toEqual(fixture.emotionDistribution);
    expect(result.journalScreening.items).toEqual(screening.items);
    await service.retryScreening(user, journal);
    await service.retryScreening(user, journal);
    await expect(service.retryScreening(user, journal)).rejects.toThrow();
    expect(calls).toBe(3);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
it("discards a retry when consent is revoked and preserves the saved result", async () => {
  const dir = mkdtempSync(join(base, "consent-")),
    store = new LocalAnalysisStore(dir),
    user = randomUUID(),
    journal = randomUUID();
  const job = store.create(user, journal, "key", "hash");
  store.set(user, job.id, "completed", 100, JSON.stringify(fixture));
  let consent = true;
  const service: any = new JournalService(
    {} as any,
    {} as any,
    {} as any,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    store,
    {
      screening: async () => {
        consent = false;
        return screening;
      },
    } as any,
  );
  service.get = async () => ({ body: "Synthetic journal" });
  service.assertAnalysisGates = async () => {};
  service.hasGlobalAnalysisConsent = async () => consent;
  try {
    await expect(service.retryScreening(user, journal)).rejects.toThrow();
    expect(JSON.parse(store.get(user, job.id)!.result_ciphertext!)).toEqual(fixture);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
