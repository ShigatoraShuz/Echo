import { expect, it } from "vitest";
import { inspectDocument } from "../../src/infrastructure/security/document-scanner.js";
import { createWindowsDefenderScanner } from "../../src/infrastructure/security/windows-defender-scanner.js";

function blankPdf(active = false): Buffer {
  const objects = [
    active ? "<< /Type /Catalog /Pages 2 0 R /OpenAction 3 0 R >>" : "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << >> >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, body] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 4\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

it.skipIf(process.platform !== "win32" || process.env.ECHO_RUN_LOCAL_SCANNER_TEST !== "true")(
  "scans and parses a synthetic PDF with the local Windows Defender adapter",
  async () => {
    const scanner = createWindowsDefenderScanner(process.env.VERIFICATION_PDFINFO_PATH!);
    const result = await inspectDocument(scanner, blankPdf(), "application/pdf");
    expect(result).toMatchObject({ scan_status: "clean", scanner_version: "windows-defender-poppler-local-v1" });
    expect((await inspectDocument(scanner, blankPdf(true), "application/pdf")).scan_status).toBe("quarantined");
  },
);
