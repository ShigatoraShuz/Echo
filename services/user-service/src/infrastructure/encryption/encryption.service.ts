import { createAesGcmEncryption } from "@echo/service-core";
export interface EncryptedPayload { ciphertext: string; iv: string; authenticationTag: string; keyVersion: number }
export interface EncryptionService { encrypt(plaintext: string): EncryptedPayload; decrypt(payload: EncryptedPayload): string }
export function createEncryptionService(base64Key: string, keyVersion: number): EncryptionService { return createAesGcmEncryption(base64Key, keyVersion); }
