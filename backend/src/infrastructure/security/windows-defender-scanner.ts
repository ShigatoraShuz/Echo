import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import type { DocumentScanner } from "./document-scanner.js";

function run(binary: string, args: string[], signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(binary, args, { signal, timeout: 12_000, maxBuffer: 64 * 1024, windowsHide: true }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

function pdfPages(info: string, bytes: Buffer): number | null {
  const pages = Number(/^Pages:\s*(\d+)\s*$/im.exec(info)?.[1]);
  if (!Number.isInteger(pages) || pages < 1 || pages > 20 ||
      !/^Encrypted:\s*no\s*$/im.test(info) ||
      !/^JavaScript:\s*no\s*$/im.test(info) ||
      !/^Form:\s*none\s*$/im.test(info) ||
      !/%%EOF\s*$/.test(bytes.toString("latin1")) ||
      /\/(?:OpenAction|AA|Launch|EmbeddedFile|RichMedia|JavaScript|JS)\b/i.test(bytes.toString("latin1")))
    return null;
  return pages;
}

export function createWindowsDefenderScanner(pdfinfoPath: string): DocumentScanner {
  const defenderPath = path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Windows Defender", "MpCmdRun.exe");
  return {
    async inspect(bytes, mime, signal) {
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const directory = await mkdtemp(path.join(tmpdir(), "echo-verification-scan-"));
      const file = path.join(directory, mime === "application/pdf" ? "evidence.pdf" : mime === "image/png" ? "evidence.png" : "evidence.jpg");
      try {
        await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
        const defender = await run(defenderPath, ["-Scan", "-ScanType", "3", "-File", file, "-DisableRemediation"], signal);
        if (!/scan finished/i.test(defender) || !/found no threats/i.test(defender))
          return { status: "quarantined", sha256 };
        if (createHash("sha256").update(await readFile(file)).digest("hex") !== sha256)
          return { status: "quarantined", sha256 };

        if (mime === "application/pdf") {
          const info = await run(pdfinfoPath, [file], signal);
          const pages = pdfPages(info, bytes);
          if (!pages || (await run(pdfinfoPath, ["-js", file], signal)).trim())
            return { status: "quarantined", sha256 };
          return { status: "clean", sha256, scannerVersion: "windows-defender-poppler-local-v1", pages };
        }

        const decoder = sharp(bytes, { failOn: "warning", limitInputPixels: 40_000_000 }).timeout({ seconds: 5 });
        try {
          const metadata = await decoder.metadata();
          if (metadata.format !== (mime === "image/png" ? "png" : "jpeg") ||
              !metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1 ||
              metadata.width * metadata.height > 40_000_000)
            return { status: "quarantined", sha256 };
          await decoder.stats();
          return { status: "clean", sha256, scannerVersion: "windows-defender-sharp-local-v1", width: metadata.width, height: metadata.height };
        } finally {
          decoder.destroy();
        }
      } catch {
        return { status: "quarantined", sha256 };
      } finally {
        await rm(file, { force: true });
        await rmdir(directory);
      }
    },
  };
}
