import { describe, expect, it } from "vitest";
import { createEncryptionService, decodeEncryptionKey } from "../../src/infrastructure/encryption/encryption.service.js";

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
});
