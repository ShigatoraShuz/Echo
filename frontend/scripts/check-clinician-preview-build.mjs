/** Read-only check of emitted production artifacts. Does not load fixture modules. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const frontend = fileURLToPath(new URL("../", import.meta.url));
const build = path.resolve(frontend, process.argv[2] || ".next");
if (!build.startsWith(path.resolve(frontend) + path.sep)) throw new Error("Build must be inside the frontend workspace");
const markers = [
  "Preview as Professional",
  "demo-fictional-center",
  "Fictional request: explore a manageable weekly routine",
  "Fictional reflection for the Echo clinician demonstration",
  "Fictional message: I would like to discuss a simple weekly routine",
  "Fictional reply: we can review the demo next steps together",
  "Preview Community Organization With a Long Name for Layout QA",
  "This fictional request is for visual layout review only",
  "clinician-preview-fixtures",
];
const failures = []; let scanned = 0;
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else if (/\.(?:js|mjs|json|map|html|rsc)$/.test(entry.name)) {
      scanned += 1;
      const content = await fs.readFile(absolute, "utf8");
      const found = markers.filter(marker => content.includes(marker));
      if (found.length) failures.push({ file: path.relative(build, absolute), markers: found });
    }
  }
}
await walk(path.join(build, "static")); await walk(path.join(build, "server"));
console.log(JSON.stringify({ build: path.basename(build), scanned, failures }, null, 2));
if (failures.length) process.exitCode = 1;
