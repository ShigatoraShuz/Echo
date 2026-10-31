/** Explicit asset preparation only. Runtime never downloads. */
import { mkdir, readFile, writeFile, copyFile, readdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = path.join(root, "models/voice/realtime");
await mkdir(output, { recursive: true });
const models = [];
async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(300000) });
  if (!r.ok) throw Error(`Asset HTTP ${r.status}`);
  return r;
}
for (const language of ["eng", "tgl"]) {
  const repo = "facebook/mms-tts-" + language;
  const revision =
    language === "eng" ? "c71de0fe7204c83f1c10820a7d696d0b450048ba" : "79182edde3d60484a9e7a666240917f454138a0b";
  const info = await (await get("https://huggingface.co/api/models/" + repo + "/revision/" + revision)).json();
  if (info.sha !== revision) throw Error("Unexpected voice revision");
  const names = info.siblings
    .map((x) => x.rfilename)
    .filter((x) => /^[^/]+\.(json|safetensors)$/.test(x) || x === "README.md" || x.startsWith("LICENSE"));
  if (!names.some((x) => x.endsWith(".safetensors"))) names.push("pytorch_model.bin");
  const dir = path.join(output, language);
  await mkdir(dir, { recursive: true });
  const files = [];
  for (const name of names) {
    const target = path.join(dir, name);
    await pipeline(
      Readable.fromWeb((await get(`https://huggingface.co/${repo}/resolve/${info.sha}/${name}`)).body),
      createWriteStream(target),
    );
    const bytes = await readFile(target);
    files.push({
      path: language + "/" + name,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  models.push({ repo, revision: info.sha, language, license: "cc-by-nc-4.0", files });
  console.info("Copied", repo, info.sha);
}
const vendor = path.join(root, "Echo/frontend/public/vendor/buddy-vad");
await mkdir(vendor, { recursive: true });
await copyFile(
  path.join(root, "speech-venv/Lib/site-packages/faster_whisper/assets/silero_vad_v6.onnx"),
  path.join(vendor, "silero.onnx"),
);
const ort = path.join(root, "Echo/node_modules/onnxruntime-web/dist");
const vadFiles = [];
for (const name of ["silero.onnx", ...(await readdir(ort)).filter((x) => /^ort-wasm.*\.(wasm|mjs)$/.test(x))]) {
  if (name !== "silero.onnx") await copyFile(path.join(ort, name), path.join(vendor, name));
  const bytes = await readFile(path.join(vendor, name));
  vadFiles.push({ path: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
}
const license = await (await get("https://raw.githubusercontent.com/snakers4/silero-vad/master/LICENSE")).text();
await writeFile(path.join(vendor, "SILERO-LICENSE.txt"), license, "utf8");
await writeFile(
  path.join(output, "manifest.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      models,
      vad: { source: "faster-whisper-1.2.1/silero_vad_v6.onnx", license: "MIT", files: vadFiles },
      baseVoicesOnly: true,
    },
    null,
    2,
  ),
  "utf8",
);
