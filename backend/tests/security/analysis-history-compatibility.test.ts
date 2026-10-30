import { describe, expect, it, vi } from "vitest";
import native from "../../../packages/contracts/fixtures/core-v2.json";
import pipeline from "../../../packages/contracts/fixtures/model-pipeline-v2.synthetic.json";
import { JournalService } from "../../src/features/journals/journals.service.js";
import { sealAnalysisResult, openAnalysisResult } from "../../src/infrastructure/encryption/analysis-result-encryption.js";
import { createEncryptionService } from "../../src/infrastructure/encryption/encryption.service.js";

const key = Buffer.alloc(32, 6).toString("base64");
const encryption = createEncryptionService(key, 1);
const screening = { ...native, schemaVersion: "echo-journal-analysis-v3", journalScreening: {
  status: "unavailable", experimental: true, inferenceVersion: "synthetic-history-test",
  items: null, coverage: 0, subtotal: null, total: null,
} };

describe("analysis history across integrated formats", () => {
  it.each([native, screening, pipeline])("round-trips $schemaVersion as encrypted history", (result) => {
    const sealed = sealAnalysisResult(result, encryption);
    expect(openAnalysisResult({ ciphertext: sealed.encryptedPayload }, encryption)).toEqual(result);
    expect(sealed.encryptedPayload).toMatch(/^echo:encrypted:v1:/);
  });

  it("reads prior-key history after key rotation", () => {
    const sealed = sealAnalysisResult(native, encryption);
    const rotated = createEncryptionService(Buffer.alloc(32, 9).toString("base64"), 2, { "1": key });
    expect(openAnalysisResult({ ciphertext: sealed.encryptedPayload }, rotated)).toEqual(native);
  });

  it("keeps encrypted cloud history readable when local storage is selected", () => {
    const sealed = sealAnalysisResult(native, encryption);
    // Exercise only the decoder; no service construction, storage, database, or model calls.
    const read = Reflect.get(JournalService.prototype, "readAnalysisResult") as (value: unknown) => unknown;
    expect(read.call({ encryption, localResults: {} }, { ciphertext: sealed.encryptedPayload })).toEqual(native);
  });
});


describe("encrypted history denial boundaries", () => {
  const read = Reflect.get(JournalService.prototype, "readAnalysisResult") as (value: unknown) => unknown;
  it.each([undefined, {}, { ciphertext: "echo:encrypted:v1:invalid" }, { ciphertext: JSON.stringify(native) }])("rejects malformed or plaintext cloud records", (record) => {
    expect(() => read.call({ encryption }, record)).toThrow();
  });

  it("does not treat a tampered encrypted envelope as legacy local JSON", () => {
    const sealed = sealAnalysisResult(native, encryption).encryptedPayload;
    const prefix = "echo:encrypted:v1:";
    const envelope = JSON.parse(Buffer.from(sealed.slice(prefix.length), "base64").toString("utf8"));
    envelope.authenticationTag = Buffer.alloc(16).toString("base64");
    const tampered = prefix + Buffer.from(JSON.stringify(envelope)).toString("base64");
    expect(() => read.call({ encryption, localResults: {} }, { ciphertext: tampered })).toThrow();
  });

  it("rejects history when the decrypting key is not authorized", () => {
    const sealed = sealAnalysisResult(native, encryption);
    const other = createEncryptionService(Buffer.alloc(32, 8).toString("base64"), 1);
    expect(() => read.call({ encryption: other, localResults: {} }, { ciphertext: sealed.encryptedPayload })).toThrow();
  });

  it("checks journal ownership before looking up or decrypting any history", async () => {
    const denied = new Error("Synthetic ownership denial");
    const get = vi.fn().mockRejectedValue(denied);
    const schema = vi.fn(() => { throw new Error("Must not query history"); });
    const decrypt = vi.fn(() => { throw new Error("Must not decrypt history"); });
    const latest = JournalService.prototype.getLatestAnalysis;
    const service = { get, database: { schema }, encryption: { decrypt } };
    await expect(latest.call(service as unknown as JournalService, "fictional-other-user", "fictional-journal")).rejects.toBe(denied);
    expect(get).toHaveBeenCalledWith("fictional-other-user", "fictional-journal");
    expect(schema).not.toHaveBeenCalled();
    expect(decrypt).not.toHaveBeenCalled();
  });
});


it("rejects another user's journal through the real ownership query before analysis decryption", async () => {
  const builder = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const from = vi.fn().mockReturnValue(builder);
  const schema = vi.fn().mockReturnValue({ from });
  const databaseSchema = vi.fn(() => { throw new Error("No history access allowed"); });
  const decrypt = vi.fn();
  const service = Object.assign(Object.create(JournalService.prototype), {
    database: { schema: databaseSchema }, encryption: { decrypt },
  }) as JournalService;
  Object.defineProperty(service, "reader", { value: { schema } });
  await expect(service.getLatestAnalysis("fictional-other-user", "fictional-journal")).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(schema).toHaveBeenCalledWith("journal_service");
  expect(from).toHaveBeenCalledWith("journals");
  expect(builder.eq).toHaveBeenCalledWith("id", "fictional-journal");
  expect(builder.eq).toHaveBeenCalledWith("user_id", "fictional-other-user");
  expect(builder.is).toHaveBeenCalledWith("deleted_at", null);
  expect(databaseSchema).not.toHaveBeenCalled();
  expect(decrypt).not.toHaveBeenCalled();
});
