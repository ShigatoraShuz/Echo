/** VAD-only asset preparation; speech is provided by MOSS Nano / optional v1.5. */
import { mkdir, readFile, writeFile, copyFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(300000) });
  if (!r.ok) throw Error(`Asset HTTP ${r.status}`);
  return r;
}
const vendor = path.join(root, "frontend/public/vendor/buddy-vad");
await mkdir(vendor, { recursive: true });
await copyFile(
  path.join(root, "ai-service/.venv-speech/Lib/site-packages/faster_whisper/assets/silero_vad_v6.onnx"),
  path.join(vendor, "silero.onnx"),
);
const ort = path.join(root, "node_modules/onnxruntime-web/dist");
const vadFiles = [];
for (const name of ["silero.onnx", ...(await readdir(ort)).filter((x) => /^ort-wasm.*\.(wasm|mjs)$/.test(x))]) {
  if (name !== "silero.onnx") await copyFile(path.join(ort, name), path.join(vendor, name));
  const bytes = await readFile(path.join(vendor, name));
  vadFiles.push({ path: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
}
const license = await (await get("https://raw.githubusercontent.com/snakers4/silero-vad/master/LICENSE")).text();
await writeFile(path.join(vendor, "SILERO-LICENSE.txt"), license, "utf8");
await writeFile(path.join(vendor, "manifest.json"), JSON.stringify({schemaVersion: 1, source: "faster-whisper-1.2.1/silero_vad_v6.onnx", license: "MIT", files: vadFiles}, null, 2), "utf8");
