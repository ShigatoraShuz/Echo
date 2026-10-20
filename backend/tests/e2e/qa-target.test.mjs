import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadQaTarget } from "./qa-target.mjs";

test("staging QA rejects mismatched and insecure targets before any account is created", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "echo-staging-guard-"));
  const ref = randomUUID().replaceAll("-", "").slice(0, 20);
  const file = path.join(directory, ".env");
  const previous = Object.fromEntries([
    "ECHO_QA_ENV_FILE", "ECHO_STAGING_PROJECT_REF", "ECHO_STAGING_BASE_URL", "ECHO_STAGING_API_BASE_URL",
  ].map((name) => [name, process.env[name]]));
  try {
    writeFileSync(file, `SUPABASE_URL=https://${ref}.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=synthetic\nSUPABASE_PUBLISHABLE_KEY=synthetic\n`);
    process.env.ECHO_QA_ENV_FILE = file;
    process.env.ECHO_STAGING_PROJECT_REF = ref;
    process.env.ECHO_STAGING_BASE_URL = "https://staging.example.invalid";
    process.env.ECHO_STAGING_API_BASE_URL = "https://api.staging.example.invalid/api/v1";
    assert.equal(loadQaTarget().staging, true);
    process.env.ECHO_STAGING_PROJECT_REF = "wrongprojectref";
    assert.throws(loadQaTarget, /separate HTTPS/);
    process.env.ECHO_STAGING_PROJECT_REF = ref;
    process.env.ECHO_STAGING_BASE_URL = "http://127.0.0.1:3000";
    assert.throws(loadQaTarget, /separate HTTPS/);
    const linkedFile = path.resolve(process.cwd(), "../supabase/.temp/project-ref");
    const linked = existsSync(linkedFile) ? readFileSync(linkedFile, "utf8").trim() : "";
    if (linked) {
      writeFileSync(file, `SUPABASE_URL=https://${linked}.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=synthetic\nSUPABASE_PUBLISHABLE_KEY=synthetic\n`);
      process.env.ECHO_STAGING_PROJECT_REF = linked;
      process.env.ECHO_STAGING_BASE_URL = "https://staging.example.invalid";
      assert.throws(loadQaTarget, /currently linked/);
    }
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    unlinkSync(file);
    rmdirSync(directory);
  }
});
