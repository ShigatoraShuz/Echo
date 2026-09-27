import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertDocumentsClean, inspectDocument, quarantineScanner, validateDocument } from "../../src/infrastructure/security/document-scanner.js";
import { createEncryptionService, encryptText, decryptText } from "../../src/infrastructure/encryption/encryption.service.js";

describe("restricted storage", () => {
  const pdf = Buffer.from("%PDF-1.7\n synthetic fixture\n%%EOF");
  it("stores opaque, authenticated Buddy envelopes and refuses plaintext fallback", () => {
    const crypto = createEncryptionService(Buffer.alloc(32, 7).toString("base64"), 1);
    const a = encryptText("synthetic private message", crypto);
    expect(a).not.toContain("synthetic"); expect(a).not.toBe(encryptText("synthetic private message", crypto));
    expect(decryptText(a, crypto)).toBe("synthetic private message");
    expect(() => decryptText("legacy plaintext", crypto)).toThrow();
  });
  it("rejects MIME spoofing and oversized files", () => {
    expect(() => validateDocument(pdf, "image/png")).toThrow();
    expect(() => validateDocument(Buffer.alloc(8 * 1024 * 1024 + 1), "application/pdf")).toThrow();
    expect(() => validateDocument(Buffer.from('<svg onload="alert(1)">'), "image/svg+xml")).toThrow();
  });
  it("quarantines files by default and blocks reviewer downloads", async () => {
    const scan = await inspectDocument(quarantineScanner, pdf, "application/pdf");
    expect(scan.scan_status).toBe("quarantined"); expect(() => assertDocumentsClean([scan])).toThrow();
    expect(() => assertDocumentsClean([{ scan_status: "clean" }])).toThrow();
  });
  it("requires a matching digest, scanner version and bounded decoded metadata", async () => {
    const clean = { status: "clean" as const, sha256: createHash("sha256").update(pdf).digest("hex"), scannerVersion: "test-only", pages: 1 };
    expect((await inspectDocument({ inspect: async () => clean }, pdf, "application/pdf")).scan_status).toBe("clean");
    for (const patch of [{ sha256: "wrong" }, { pages: 21 }, { scannerVersion: undefined }])
      expect((await inspectDocument({ inspect: async () => ({ ...clean, ...patch }) }, pdf, "application/pdf")).scan_status).toBe("quarantined");
  });
  it("fails closed on scanner outages and rejects detected active content", async () => {
    expect((await inspectDocument({ inspect: async () => { throw new Error("scanner unavailable"); } }, pdf, "application/pdf")).scan_status).toBe("quarantined");
    await expect(inspectDocument({ inspect: async () => ({ status: "rejected", sha256: "" }) }, pdf, "application/pdf")).rejects.toThrow();
  });
});
