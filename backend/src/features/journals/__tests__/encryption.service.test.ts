import { describe, expect, it } from "vitest";
import { createEncryptionService, decodeEncryptionKey } from "../../../infrastructure/encryption/encryption.service.js";

const key = Buffer.alloc(32, 7).toString("base64");

describe("encryption service", () => {
  it("round trips AES-256-GCM payloads with unique IVs", () => {
    const service = createEncryptionService(key, 1);
    const first = service.encrypt("private reflection");
    const second = service.encrypt("private reflection");
    expect(service.decrypt(first)).toBe("private reflection");
    expect(first.iv).not.toBe(second.iv);
    expect(first.keyVersion).toBe(1);
  });

  it("rejects modified authenticated ciphertext and invalid keys", () => {
    const service = createEncryptionService(key, 1);
    const payload = service.encrypt("private reflection");
    expect(() => service.decrypt({ ...payload, authenticationTag: Buffer.alloc(16, 1).toString("base64") })).toThrow();
    expect(() => decodeEncryptionKey("not-a-32-byte-key")).toThrow();
  });
  it("rotates new writes while retaining only approved old keys", () => {
    const old = createEncryptionService(key, 1);
    const nextKey = Buffer.alloc(32, 9).toString("base64");
    const rotated = createEncryptionService(nextKey, 2, { "1": key });
    const oldPayload = old.encrypt("synthetic restricted content");
    expect(rotated.decrypt(oldPayload)).toBe("synthetic restricted content");
    const nextPayload = rotated.encrypt(rotated.decrypt(oldPayload));
    expect(nextPayload.keyVersion).toBe(2);
    expect(createEncryptionService(nextKey, 2).decrypt(nextPayload)).toBe("synthetic restricted content");
    expect(() => createEncryptionService(nextKey, 2).decrypt(oldPayload)).toThrow();
  });
  it("rejects wrong keys, unknown/missing metadata and modified ciphertext", () => {
    const service = createEncryptionService(key, 1);
    const payload = service.encrypt("private reflection");
    expect(() => createEncryptionService(Buffer.alloc(32, 8).toString("base64"), 1).decrypt(payload)).toThrow();
    for (const patch of [{ keyVersion: 99 }, { iv: "" }, { authenticationTag: "" }, { ciphertext: "AQ==" }])
      expect(() => service.decrypt({ ...payload, ...patch })).toThrow();
    expect(() => createEncryptionService(key, 2, { "1": key })).toThrow();
  });
});
