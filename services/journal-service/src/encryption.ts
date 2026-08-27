import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedPayload = { ciphertext: string; iv: string; authenticationTag: string; keyVersion: number };

export function createEncryption(keyBase64: string, keyVersion: number) {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) throw new Error("JOURNAL_ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes.");
  return {
    encrypt(plaintext: string): EncryptedPayload {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      return {
        ciphertext: Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]).toString("base64"),
        iv: iv.toString("base64"), authenticationTag: cipher.getAuthTag().toString("base64"), keyVersion,
      };
    },
    decrypt(payload: EncryptedPayload): string {
      if (payload.keyVersion !== keyVersion) throw new Error("Unsupported journal encryption key version.");
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
      decipher.setAuthTag(Buffer.from(payload.authenticationTag, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()]).toString("utf8");
    },
  };
}
export type Encryption = ReturnType<typeof createEncryption>;
