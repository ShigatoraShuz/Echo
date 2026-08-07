import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authenticationTag: string;
  keyVersion: number;
}

export interface EncryptionService {
  encrypt(plaintext: string): EncryptedPayload;
  decrypt(payload: EncryptedPayload): string;
}

export function decodeEncryptionKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new Error("Journal encryption key must decode to 32 bytes.");
  return key;
}

export function createEncryptionService(base64Key: string, keyVersion: number): EncryptionService {
  const key = decodeEncryptionKey(base64Key);
  if (!Number.isInteger(keyVersion) || keyVersion < 1) {
    throw new Error("Journal encryption key version must be a positive integer.");
  }

  return {
    encrypt(plaintext) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      return {
        ciphertext: ciphertext.toString("base64"),
        iv: iv.toString("base64"),
        authenticationTag: cipher.getAuthTag().toString("base64"),
        keyVersion,
      };
    },
    decrypt(payload) {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
      decipher.setAuthTag(Buffer.from(payload.authenticationTag, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(payload.ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}
