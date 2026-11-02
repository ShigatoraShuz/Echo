import { createHash } from "node:crypto";
import { PDFDocument, PDFName, PDFNumber } from "pdf-lib";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { basicDocumentValidator, BASIC_DOCUMENT_VALIDATOR_VERSION } from "./basic-document-validator.js";
import { assertDocumentsClean, inspectDocument, quarantineScanner } from "./document-scanner.js";

async function image(format: "png" | "jpeg", width = 256, height = 128) {
  return sharp({ create: { width, height, channels: 3, background: "white" } }).toFormat(format).toBuffer();
}
async function pdf(pages = 1, useObjectStreams = true) {
  const document = await PDFDocument.create();
  for (let i = 0; i < pages; i++) document.addPage([595, 842]);
  return Buffer.from(await document.save({ addDefaultPage: false, useObjectStreams }));
}

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in document tests"); })));
afterEach(() => vi.unstubAllGlobals());

describe("basic document validation — not malware scanning", () => {
  it.each(["png", "jpeg"] as const)("fully decodes a real %s and returns matching provenance", async format => {
    const bytes = await image(format);
    const result = await basicDocumentValidator.inspect(bytes, `image/${format}`, new AbortController().signal);
    expect(result).toEqual({ status: "clean", width: 256, height: 128,
      sha256: createHash("sha256").update(bytes).digest("hex"), scannerVersion: BASIC_DOCUMENT_VALIDATOR_VERSION });
    expect(BASIC_DOCUMENT_VALIDATOR_VERSION).toContain("not-malware-scan");
  });

  it.each([false, true])("parses actual PDF objects and pages (object streams: %s)", async objectStreams => {
    const result = await basicDocumentValidator.inspect(await pdf(2, objectStreams), "application/pdf", new AbortController().signal);
    expect(result).toMatchObject({ status: "clean", pages: 2, scannerVersion: BASIC_DOCUMENT_VALIDATOR_VERSION });
  });

  it("allows 20 PDF pages but rejects 21 and empty page trees", async () => {
    await expect(inspectDocument(basicDocumentValidator, await pdf(20), "application/pdf")).resolves.toMatchObject({ scan_status: "quarantined" });
    for (const count of [0, 21]) await expect(inspectDocument(basicDocumentValidator, await pdf(count), "application/pdf")).rejects.toThrow();
  });

  it("rejects encrypted PDFs and invalid page geometry", async () => {
    const encrypted = await PDFDocument.create();
    encrypted.addPage();
    encrypted.context.trailerInfo.Encrypt = encrypted.context.register(encrypted.context.obj({ Filter: "Standard" }));
    await expect(inspectDocument(basicDocumentValidator, Buffer.from(await encrypted.save()), "application/pdf")).rejects.toThrow();
    const oversized = await PDFDocument.create(); oversized.addPage([20000, 842]);
    await expect(inspectDocument(basicDocumentValidator, Buffer.from(await oversized.save()), "application/pdf")).rejects.toThrow();
  });

  it("does not trust a declared page Count without parsing the actual page tree", async () => {
    const document = await PDFDocument.create();
    for (let i = 0; i < 21; i++) document.addPage();
    document.catalog.Pages().set(PDFName.of("Count"), PDFNumber.of(1));
    const bytes = Buffer.from(await document.save({ useObjectStreams: false }));
    await expect(inspectDocument(basicDocumentValidator, bytes, "application/pdf")).rejects.toThrow();
  });

  it.each(["png", "jpeg"] as const)("rejects truncated %s even when its signature survives", async format => {
    const bytes = await image(format);
    await expect(inspectDocument(basicDocumentValidator, bytes.subarray(0, Math.floor(bytes.length / 2)), `image/${format}`)).rejects.toThrow();
  });

  it("rejects broken PNG pixels even with a valid header and IEND", async () => {
    const bytes = await image("png");
    const idat = bytes.indexOf(Buffer.from("IDAT"));
    bytes.fill(0xff, idat + 4, idat + 12);
    await expect(inspectDocument(basicDocumentValidator, bytes, "image/png")).rejects.toThrow();
  });

  it("rejects header/EOF-only PDF spoofs and truncated actual PDFs", async () => {
    const fake = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstartxref\n9\n%%EOF\n");
    await expect(inspectDocument(basicDocumentValidator, fake, "application/pdf")).rejects.toThrow();
    const bytes = await pdf();
    await expect(inspectDocument(basicDocumentValidator, bytes.subarray(0, bytes.length - 25), "application/pdf")).rejects.toThrow();
  });

  it("rejects unsupported MIME, mismatched MIME and files over 8 MiB", async () => {
    const bytes = await image("png");
    for (const mime of ["image/jpeg", "image/svg+xml", "application/pdf"]) {
      await expect(inspectDocument(basicDocumentValidator, bytes, mime)).rejects.toThrow();
    }
    const large = Buffer.alloc(8 * 1024 * 1024 + 1); bytes.copy(large);
    await expect(inspectDocument(basicDocumentValidator, large, "image/png")).rejects.toThrow();
  });

  it.each([[63, 128], [12001, 64]])("rejects unreasonable image dimensions %s x %s", async (width, height) => {
    await expect(inspectDocument(basicDocumentValidator, await image("png", width, height), "image/png")).rejects.toThrow();
  });

  it("fails closed on cancellation and stops PDF parsing", async () => {
    const bytes = await pdf();
    const controller = new AbortController();
    const pending = basicDocumentValidator.inspect(bytes, "application/pdf", controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow("interrupted");
    await expect(basicDocumentValidator.inspect(await image("png"), "image/png", controller.signal)).resolves.toMatchObject({ status: "quarantined" });
  });

  it("keeps scanner failure, timeout, forged digests and missing metadata quarantined", async () => {
    const bytes = await image("png");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    for (const response of [
      { status: "clean" as const, sha256: "wrong", width: 256, height: 128, scannerVersion: "fixture" },
      { status: "clean" as const, sha256 },
    ]) await expect(inspectDocument({ inspect: async () => response }, bytes, "image/png")).resolves.toMatchObject({ scan_status: "quarantined" });
    await expect(inspectDocument({ inspect: async () => { throw new Error("Unavailable"); } }, bytes, "image/png")).resolves.toMatchObject({ scan_status: "quarantined" });
    vi.useFakeTimers();
    try {
      const pending = inspectDocument({ inspect: () => new Promise(() => {}) }, bytes, "image/png");
      await vi.advanceTimersByTimeAsync(15_001);
      await expect(pending).resolves.toMatchObject({ scan_status: "quarantined" });
    } finally { vi.useRealTimers(); }
  });

  it("keeps structural-only validation and the default scanner outside the malware approval gate", async () => {
    const bytes = await image("png");
    const clean = await inspectDocument(basicDocumentValidator, bytes, "image/png");
    expect(clean.scan_status).toBe("quarantined");
    expect(() => assertDocumentsClean([clean])).toThrow();
    expect(() => assertDocumentsClean([{ scan_status: "clean", scanned_at: new Date().toISOString(),
      scanner_version: BASIC_DOCUMENT_VALIDATOR_VERSION }])).toThrow();
    const unchanged = { scan_status: "quarantined", scanned_at: null, scanner_version: null };
    expect(() => assertDocumentsClean([unchanged])).toThrow();
    expect(unchanged.scan_status).toBe("quarantined");
    await expect(inspectDocument(quarantineScanner, bytes, "image/png")).resolves.toEqual(unchanged);
  });
});
