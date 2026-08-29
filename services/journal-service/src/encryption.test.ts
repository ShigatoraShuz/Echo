import { describe, expect, it } from "vitest";
import { createEncryption } from "./encryption.js";

const key = Buffer.alloc(32, 7).toString("base64");

describe("journal AES-256-GCM", () => {
  it("round-trips plaintext with a random nonce", () => {
    const encryption = createEncryption(key, 1);
    const first = encryption.encrypt("private journal text");
    const second = encryption.encrypt("private journal text");
    expect(first.ciphertext).not.toBe("private journal text");
    expect(first.iv).not.toBe(second.iv);
    expect(encryption.decrypt(first)).toBe("private journal text");
  });

  it("rejects an unsupported key version or modified authentication tag", () => {
    const encryption = createEncryption(key, 1);
    const payload = encryption.encrypt("private journal text");
    expect(() => encryption.decrypt({ ...payload, keyVersion: 2 })).toThrow(/key version/i);
    expect(() => encryption.decrypt({ ...payload, authenticationTag: Buffer.alloc(16).toString("base64") })).toThrow();
  });
});
