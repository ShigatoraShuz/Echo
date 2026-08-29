import { createAesGcmEncryption } from "@echo/service-core";
export function createEncryption(keyBase64: string, keyVersion: number) { return createAesGcmEncryption(keyBase64, keyVersion); }
export type Encryption = ReturnType<typeof createEncryption>;
