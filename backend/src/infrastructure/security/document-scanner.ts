import { createHash } from "node:crypto";
import { ConflictError, ValidationError } from "../../shared/errors/app-error.js";

export interface DocumentScanner {
  inspect(bytes: Buffer, mime: string, signal: AbortSignal): Promise<{
    status: "clean" | "rejected" | "quarantined";
    sha256: string;
    scannerVersion?: string;
    pages?: number;
    width?: number;
    height?: number;
  }>;
}
export const quarantineScanner: DocumentScanner = {
  async inspect(bytes) { return { status: "quarantined", sha256: createHash("sha256").update(bytes).digest("hex") }; },
};
export function validateDocument(bytes: Buffer, mime: string): void {
  const match = mime === "application/pdf" ? bytes.subarray(0, 5).toString("ascii") === "%PDF-" :
    mime === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
    mime === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!match || bytes.length < 12 || bytes.length > 8 * 1024 * 1024)
    throw new ValidationError({ document: ["Choose a valid JPG, PNG or PDF no larger than 8 MB."] });
}
export async function inspectDocument(scanner: DocumentScanner, bytes: Buffer, mime: string) {
  validateDocument(bytes, mime);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  try {
    const result = await Promise.race([
      scanner.inspect(bytes, mime, controller.signal),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Scanner timed out.")); }, 15_000); }),
    ]);
    if (result.status === "rejected") throw new ValidationError({ document: ["This document was rejected by the security scan."] });
    const validDimensions = mime === "application/pdf" ? Number.isInteger(result.pages) && result.pages! > 0 && result.pages! <= 20 :
      Number.isInteger(result.width) && Number.isInteger(result.height) && result.width! > 0 && result.height! > 0 && result.width! * result.height! <= 40_000_000;
    if (result.status === "clean" && result.sha256 === sha256 && result.scannerVersion && result.scannerVersion.length <= 100 && validDimensions)
      return { scan_status: "clean", scanned_at: new Date().toISOString(), scanner_version: result.scannerVersion };
  } catch (error) { if (error instanceof ValidationError) throw error; }
  finally { if (timer) clearTimeout(timer); }
  return { scan_status: "quarantined", scanned_at: null, scanner_version: null };
}
export function assertDocumentsClean(documents: Array<Record<string, unknown>>): void {
  if (documents.some((document) => document.scan_status !== "clean" || !document.scanned_at || !document.scanner_version))
    throw new ConflictError("DOCUMENT_SCAN_PENDING", "Document security checks must finish before review.");
}
