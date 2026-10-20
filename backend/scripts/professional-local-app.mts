import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { FIXTURE_TAG, LOCAL_API, localEnvironment } from "./lib/professional-local-target.mts";

// Opt-in launcher: .env files and remote secrets remain unchanged. Existing npm
// development commands receive verified local process-environment overrides.
async function main() {
  const workspace = process.argv[2];
  if (!["backend", "frontend"].includes(workspace ?? "") || process.argv.length !== 3) {
    throw new Error("Usage: node --import tsx backend/scripts/professional-local-app.mts backend|frontend");
  }
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const local = localEnvironment(root);
  const fixture = JSON.parse(await readFile(new URL("../tmp/professional-fixtures/state.json", import.meta.url), "utf8"));
  if (fixture.tag !== FIXTURE_TAG || fixture.fingerprint !== local.fingerprint || !fixture.complete || fixture.retired) {
    throw new Error("Current local fixture manifest is required; no application started.");
  }
  const common = { ...process.env, NODE_ENV: "development" };
  const env = workspace === "backend" ? {
    ...common, PORT: "4200", FRONTEND_URL: "http://127.0.0.1:3000", SUPABASE_URL: LOCAL_API,
    SUPABASE_PUBLISHABLE_KEY: local.anonKey, SUPABASE_SERVICE_ROLE_KEY: local.serviceKey,
    JOURNAL_ENCRYPTION_KEY_BASE64: fixture.encryptionKey, JOURNAL_ENCRYPTION_KEY_VERSION: "1",
    ENCRYPTION_PREVIOUS_KEYS_JSON: "{}", SIGNUP_DRAFT_SECRET: fixture.registrationSecret,
    IDEMPOTENCY_HMAC_ACTIVE_VERSION: "local-v1", IDEMPOTENCY_HMAC_KEYS_JSON: JSON.stringify({
      "local-v1": createHmac("sha256", fixture.registrationSecret).update("local-app-idempotency-v1").digest("hex"),
    }), GOOGLE_WEB_CLIENT_ID: "", AI_ANALYSIS_MODE: "disabled", AI_DEVELOPMENT_USER_IDS: "",
    AI_WORKER_TOKEN: createHmac("sha256", fixture.registrationSecret).update("disabled-local-worker").digest("hex"),
  } : {
    ...common, NEXT_PUBLIC_SUPABASE_URL: LOCAL_API, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.anonKey,
    NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:4200/api/v1", GATEWAY_API_BASE_URL: "http://127.0.0.1:4200/api/v1",
    NEXT_PUBLIC_DATA_ADAPTER: "http", NEXT_PUBLIC_GOOGLE_CLIENT_ID: "", NEXT_DIST_DIR: ".next",
  };
  process.stdout.write(`Starting actual ${workspace} with verified LOCAL Supabase; existing .env files preserved.\n`);
  const child = spawn("cmd.exe", ["/d", "/s", "/c", `npm run dev --workspace ${workspace}`], { cwd: root, env, stdio: "inherit", windowsHide: true });
  child.on("error", () => { process.stderr.write("Local app process could not start.\n"); process.exitCode = 1; });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
}
main().catch(() => { process.stderr.write("Local application preflight failed; no secrets printed. Verify Docker and fixture state.\n"); process.exitCode = 1; });
