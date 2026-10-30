import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";
import sharp from "sharp";
import { validateDocument, type DocumentScanner } from "./document-scanner.js";

export const BASIC_DOCUMENT_VALIDATOR_VERSION = "basic-document-validation-v1-not-malware-scan";
const maxPixels = 40_000_000;

// Parsing is isolated: corrupt/cyclic PDF objects cannot block the API event loop.
// This only parses document structure. It never renders content or runs PDF actions.
const pdfWorker = `
  const { parentPort, workerData } = require("node:worker_threads");
  const { PDFDocument } = require(workerData.library);
  (async () => {
    try {
      const pdf = await PDFDocument.load(workerData.bytes, {
        ignoreEncryption: false, throwOnInvalidObject: true, updateMetadata: false,
      });
      const pages = pdf.getPages();
      const valid = !pdf.isEncrypted && pages.length >= 1 && pages.length <= 20 && pages.every(page => {
        const { width, height } = page.getSize();
        return Number.isFinite(width) && Number.isFinite(height) && width >= 1 && height >= 1 && width <= 14400 && height <= 14400;
      });
      parentPort.postMessage(valid ? pages.length : null);
    } catch { parentPort.postMessage(null); }
  })();
`;

function pdfPageCount(bytes: Buffer, signal: AbortSignal): Promise<number | null> {
  const worker = new Worker(pdfWorker, {
    eval: true, workerData: { bytes, library: require.resolve("pdf-lib") },
    stdout: true, stderr: true,
    resourceLimits: { maxOldGenerationSizeMb: 64, stackSizeMb: 4 },
  });
  // Parser diagnostics must not leak document contents to application logs.
  worker.stdout?.resume();
  worker.stderr?.resume();
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error: Error | null, pages: number | null = null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      void worker.terminate();
      if (error) reject(error); else resolve(pages);
    };
    const abort = () => finish(new Error("Document validation interrupted."));
    const timer = setTimeout(abort, 8_000);
    worker.once("message", (pages: number | null) => finish(null, pages));
    worker.once("error", () => finish(new Error("Document validator unavailable.")));
    worker.once("exit", () => finish(new Error("Document validator exited.")));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

/** Thesis-development structural validation, NOT antivirus, credential verification or approval. */
export const basicDocumentValidator: DocumentScanner = {
  async inspect(bytes, mime, signal) {
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const rejected = { status: "rejected" as const, sha256 };
    try { validateDocument(bytes, mime); } catch { return rejected; }
    if (signal.aborted) return { status: "quarantined", sha256 };
    if (mime === "application/pdf") {
      // Reject truncated/header-only files before asking the actual object parser.
      const header = bytes.subarray(0, 12).toString("latin1");
      const trailer = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(bytes.subarray(-1024).toString("latin1"));
      const offset = trailer ? Number(trailer[1]) : NaN;
      if (!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(header) || !Number.isSafeInteger(offset) || offset <= 0 || offset >= bytes.length ||
          !/^(?:xref\b|\d+\s+\d+\s+obj\b)/.test(bytes.subarray(offset, offset + 80).toString("latin1"))) return rejected;
      // Worker errors/timeouts propagate to inspectDocument's fail-closed quarantine.
      const pages = await pdfPageCount(bytes, signal);
      if (!pages) return rejected;
      return { status: "clean", sha256, pages, scannerVersion: BASIC_DOCUMENT_VALIDATOR_VERSION };
    }
    // Require complete terminal markers as well as the existing MIME/signature check.
    if (mime === "image/jpeg" && !bytes.subarray(-2).equals(Buffer.from([0xff, 0xd9]))) return rejected;
    if (mime === "image/png" && !bytes.subarray(-12).equals(Buffer.from("0000000049454e44ae426082", "hex"))) return rejected;
    const image = sharp(bytes, { failOn: "warning", limitInputPixels: maxPixels, sequentialRead: true }).timeout({ seconds: 8 });
    try {
      const metadata = await image.metadata();
      const { width, height } = metadata;
      if (metadata.format !== (mime === "image/png" ? "png" : "jpeg") || (metadata.pages ?? 1) !== 1 ||
          !width || !height || width < 64 || height < 64 || width > 12000 || height > 12000 || width * height > maxPixels) return rejected;
      await image.stats(); // Full pixel decode; metadata/signatures alone are insufficient.
      if (signal.aborted) return { status: "quarantined", sha256 };
      return { status: "clean", sha256, width, height, scannerVersion: BASIC_DOCUMENT_VALIDATOR_VERSION };
    } catch { return rejected; }
    finally { image.destroy(); }
  },
};
