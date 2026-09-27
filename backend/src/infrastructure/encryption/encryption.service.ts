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
  if (key.length !== 32 || key.toString("base64") !== base64Key) throw new Error("Encryption key must be canonical base64 encoding exactly 32 bytes.");
  return key;
}

export function createEncryptionService(base64Key: string, keyVersion: number, previousKeys: Record<string, string> = {}): EncryptionService {
  const key = decodeEncryptionKey(base64Key);
  if (!Number.isInteger(keyVersion) || keyVersion < 1) {
    throw new Error("Journal encryption key version must be a positive integer.");
  }
  const keys = new Map<number, Buffer>();
  for (const [version, previousKey] of Object.entries(previousKeys)) {
    if (!/^[1-9]\d*$/.test(version) || !Number.isSafeInteger(Number(version)) || Number(version) === keyVersion)
      throw new Error("Invalid previous encryption key version.");
    keys.set(Number(version), decodeEncryptionKey(previousKey));
  }
  keys.set(keyVersion, key);
  if (new Set([...keys.values()].map((value) => value.toString("base64"))).size !== keys.size)
    throw new Error("Each encryption key version must use a distinct key.");
  function decode(value: string, length?: number): Buffer {
    if (typeof value !== "string") throw new Error("Invalid encrypted payload.");
    const decoded = Buffer.from(value, "base64");
    if (decoded.toString("base64") !== value || (length !== undefined && decoded.length !== length))
      throw new Error("Invalid encrypted payload.");
    return decoded;
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
      const decryptionKey = keys.get(payload.keyVersion);
      if (!decryptionKey) throw new Error("Unapproved encryption key version.");
      const decipher = createDecipheriv("aes-256-gcm", decryptionKey, decode(payload.iv, 12));
      decipher.setAuthTag(decode(payload.authenticationTag, 16));
      return Buffer.concat([
        decipher.update(decode(payload.ciphertext)),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}

const ENVELOPE_PREFIX = "echo:encrypted:v1:";
export function encryptText(value: string, encryption: EncryptionService): string {
  return ENVELOPE_PREFIX + Buffer.from(JSON.stringify(encryption.encrypt(value))).toString("base64");
}
export function decryptText(value: unknown, encryption: EncryptionService): string {
  if (typeof value !== "string" || !value.startsWith(ENVELOPE_PREFIX))
    throw new Error("Restricted plaintext requires a reviewed encryption backfill.");
  const payload = JSON.parse(Buffer.from(value.slice(ENVELOPE_PREFIX.length), "base64").toString("utf8")) as EncryptedPayload;
  return encryption.decrypt(payload);
}
