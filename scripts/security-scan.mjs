import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";

const root = process.cwd();
const findings = [];
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
for (const file of files) {
  if (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith(".example")) findings.push([file, "tracked environment file"]);
  if (!/\.(?:[cm]?[jt]sx?|json|ya?ml|toml|sql|env|example|md)$/.test(file)) continue;
  let text;
  try { text = await readFile(resolve(root, file), "utf8"); }
  catch (error) { if (error.code === "ENOENT") continue; throw error; }
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) findings.push([file, "private key material"]);
  if (/(?:sb_secret_[A-Za-z0-9_-]{20,}|(?:sk-proj-|sk-ant-)[A-Za-z0-9_-]{20,})/.test(text)) findings.push([file, "secret credential pattern"]);
  if (/NEXT_PUBLIC_[A-Z_]*(?:SERVICE_ROLE|SECRET_KEY|ENCRYPTION_KEY|AI_API_KEY)\s*(?:=|:)/.test(text)) findings.push([file, "public secret configuration"]);
  if (file.startsWith("frontend/src/") && /(?:supabase-admin\.client|SUPABASE_SERVICE_ROLE_KEY|JOURNAL_ENCRYPTION_KEY_BASE64)/.test(text)) findings.push([file, "frontend backend-secret boundary"]);
}
if (process.argv.includes("--bundle")) {
  const bundle = resolve(root, "frontend/.next/static");
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = resolve(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/\.(?:js|map|json)$/.test(file)) {
        const text = await readFile(file, "utf8");
        if (/sb_secret_[A-Za-z0-9_-]{20,}|SUPABASE_SERVICE_ROLE_KEY|JOURNAL_ENCRYPTION_KEY_BASE64|-----BEGIN .*PRIVATE KEY/.test(text))
          findings.push([relative(root, file), "bundle secret boundary"]);
      }
    }
  }
  await walk(bundle); // Missing build is a failure, never a passing scan.
}
// Never print the matched content; filenames and rule names are sufficient.
for (const [file, rule] of findings) console.error(JSON.stringify({ file, rule }));
console.info(`Security source/bundle scan: ${files.length} tracked/untracked paths; ${findings.length} findings.`);
if (findings.length) process.exitCode = 1;
