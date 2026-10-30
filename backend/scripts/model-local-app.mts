import { spawn, execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { localEnvironment, LOCAL_API, FIXTURE_TAG } from "./lib/professional-local-target.mts";
import { consultationFrontendPort, consultationOrigin } from "./lib/consultation-origin.mts";
import { developmentConfiguration } from "./lib/local-development.mts";
import { waitForConsultation } from "./lib/consultation-startup.mts";

const [workspace, mode = "synthetic"] = process.argv.slice(2);
if (!["backend", "frontend", "ai"].includes(workspace) || !["synthetic", "partial", "swap", "real", "consultation", "development"].includes(mode))
  throw new Error("Usage: model-local-app.mts backend|frontend|ai synthetic|partial|swap|real|consultation [--live]");
const root = process.cwd(),
  local = localEnvironment(root);
if (workspace === "backend")
  execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "packages/contracts/tsconfig.build.json"], {
    cwd: root,
    stdio: "inherit",
  });
if (mode === "development") {
  const config = developmentConfiguration(root);
  if (workspace === "backend") await waitForConsultation(async () => {
    const response = await fetch("http://127.0.0.1:8100/engineering/v2/models", {
      headers: { Authorization: `Bearer ${config.secret("model-service-v1")}` }, signal: AbortSignal.timeout(2000), redirect: "error",
    }).catch(() => null);
    if (!response?.ok) return false;
    const status = await response.json();
    return status.executionMode === "real" && Object.entries(config.tasks).every(([task, identity]) =>
      status.models[task]?.status === "validated_not_loaded" && `${status.models[task].modelId}@${status.models[task].modelVersion}` === identity);
  });
  if (workspace === "frontend") await waitForConsultation(() => fetch("http://127.0.0.1:4300/api/v1/verification", {
    signal: AbortSignal.timeout(2000), redirect: "error",
  }).then(response => response.status === 401).catch(() => false));
  const child = spawn(workspace === "ai" ? resolve("ai-service/.venv/Scripts/python.exe") : process.execPath,
    workspace === "ai" ? ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8100", "--no-access-log"]
      : workspace === "backend" ? [resolve("node_modules/tsx/dist/cli.mjs"), "watch", "backend/src/server.ts"]
        : [resolve("node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3000"],
    { cwd: workspace === "ai" ? resolve("ai-service") : workspace === "frontend" ? resolve("frontend") : root,
      env: workspace === "ai" ? config.ai : workspace === "backend" ? config.backend : config.frontend,
      stdio: "inherit", windowsHide: true });
  child.on("error", () => { process.stderr.write("Local service could not start; check installed Python/Node tooling.\n"); });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => child.kill(signal));
  process.exit(await new Promise<number>(done => child.once("exit", code => done(code ?? 1))));
}
const fixture = JSON.parse(readFileSync("backend/tmp/professional-fixtures/state.json", "utf8"));
const integration = JSON.parse(readFileSync("backend/tmp/model-integration/state.json", "utf8"));
if (
  fixture.tag !== FIXTURE_TAG ||
  fixture.fingerprint !== local.fingerprint ||
  !fixture.complete ||
  fixture.retired ||
  integration.tag !== "echo-model-local-v1" ||
  integration.fingerprint !== local.fingerprint
)
  throw new Error("Fixture mismatch");
const secret = (purpose: string) => createHmac("sha256", fixture.registrationSecret).update(purpose).digest("hex");
const common = {
  ...process.env,
  NODE_ENV: "development",
  HF_HUB_OFFLINE: "1",
  TRANSFORMERS_OFFLINE: "1",
  HF_HUB_DISABLE_TELEMETRY: "1",
};
const consultation = mode === "consultation" ? JSON.parse(readFileSync("backend/tmp/student-consultation/state.json", "utf8")) : null;
if (consultation && (consultation.tag !== "echo-student-consultation-v1" || consultation.fingerprint !== local.fingerprint || consultation.accounts.some((a: { ready: boolean }) => !a.ready))) throw new Error("Consultation fixture mismatch");
// Historical fixture mode also consumes the authoritative selection, never a second config.
const activeSelection = mode === "consultation" ? JSON.parse(readFileSync("backend/models/.local/active.json", "utf8")) : null;
const selection = activeSelection ? {
  schemaVersion: "echo-consultation-selection-v1",
  cbtGeneration: activeSelection.tasks?.cbt ?? null,
  researchDiagnostic: activeSelection.tasks?.researchDiagnostic,
} : null;
if (selection && (selection.schemaVersion !== "echo-consultation-selection-v1" ||
  !/^[A-Za-z0-9._/-]+@[A-Za-z0-9._-]+$/.test(selection.researchDiagnostic) ||
  (selection.cbtGeneration !== null && !/^[A-Za-z0-9._/-]+@[A-Za-z0-9._-]+$/.test(selection.cbtGeneration))))
  throw new Error("Invalid explicit consultation model selection");
const isSynthetic = mode !== "real" && mode !== "consultation";
const tasks = mode === "partial" ? ["peak", "distress"] : !isSynthetic ? [] : ["peak", "distress", "phq8", "cbt"];
const active = Object.fromEntries(
  tasks.map((task) => [
    task,
    task === "peak" && mode === "swap"
      ? "echo-random-roberta-engineering@tiny-v1"
      : `echo-synthetic-${task}@fixture-v1`,
  ]),
);
if (selection?.cbtGeneration) active.cbt = selection.cbtGeneration;
const aiEnv = {
  ...common,
  APP_ENV: "test",
  AI_SERVICE_TOKEN: secret("model-service-v1"),
  ECHO_EXECUTION_MODE: isSynthetic ? "synthetic" : "real",
  ECHO_MODELS_DIR: resolve(mode === "consultation" ? "backend/models" : "backend/models/.engineering"),
  ECHO_ACTIVE_MODELS: JSON.stringify(active),
  MAX_NEW_TOKENS: "256",
  ECHO_STAGE_TIMEOUT_SECONDS: mode === "consultation" ? "120" : "30",
  ECHO_CONSULTATION_DEMO: String(mode === "consultation"),
  ECHO_RESEARCH_DIAGNOSTIC_ID: selection?.researchDiagnostic ?? "",
  ECHO_DIAGNOSTIC_MODELS_DIR: resolve("backend/models"),
};
const backendEnv = {
  ...common,
  PORT: "4300",
  FRONTEND_URL: consultationOrigin(),
  SUPABASE_URL: LOCAL_API,
  SUPABASE_PUBLISHABLE_KEY: local.anonKey,
  SUPABASE_SERVICE_ROLE_KEY: local.serviceKey,
  JOURNAL_ENCRYPTION_KEY_BASE64: fixture.encryptionKey,
  JOURNAL_ENCRYPTION_KEY_VERSION: "1",
  ENCRYPTION_PREVIOUS_KEYS_JSON: "{}",
  SIGNUP_DRAFT_SECRET: fixture.registrationSecret,
  IDEMPOTENCY_HMAC_ACTIVE_VERSION: "model-local-v1",
  IDEMPOTENCY_HMAC_KEYS_JSON: JSON.stringify({ "model-local-v1": secret("model-idempotency-v1") }),
  AI_ANALYSIS_MODE: "local_worker",
  AI_WORKER_TOKEN: secret("model-worker-v1"),
  AI_HTTP_BRIDGE_ENABLED: "true",
  AI_SERVICE_ORIGIN: "http://127.0.0.1:8100",
  AI_SERVICE_TOKEN: secret("model-service-v1"),
  AI_EXECUTION_MODE: isSynthetic ? "synthetic" : "real",
  AI_DEVELOPMENT_USER_IDS: consultation ? consultation.accounts.map((a: { id: string }) => a.id).join(",") : integration.userId,
  AI_CONSULTATION_DEMO: String(mode === "consultation"),
  AI_CONSULTATION_RESPONDER: selection?.cbtGeneration && !process.argv.includes("--guided") ? "model" : "guided",
  AI_JOB_TIMEOUT_MS: "180000",
  ECHO_HTTP_ONLY_MODE: "1",
  PROFESSIONAL_EVENTS_ENABLED: "false",
  EMAIL_PROVIDER: "disabled",
  PUSH_VAPID_PUBLIC_KEY: "",
  PUSH_VAPID_PRIVATE_KEY: "",
  PUSH_VAPID_SUBJECT: "",
  GOOGLE_WEB_CLIENT_ID: "",
};
const frontendEnv = {
  ...common,
  NEXT_PUBLIC_SUPABASE_URL: LOCAL_API,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.anonKey,
  NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:4300/api/v1",
  GATEWAY_API_BASE_URL: "http://127.0.0.1:4300/api/v1",
  NEXT_PUBLIC_DATA_ADAPTER: "http",
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: "",
  NEXT_DIST_DIR: ".next-model-integration",
};
const command = workspace === "ai" ? resolve("ai-service/.venv/Scripts/python.exe") : process.execPath;
const args =
  workspace === "ai"
    ? ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8100", "--no-access-log"]
    : workspace === "backend"
      ? ["--import", "tsx", "backend/src/server.ts"]
      : [resolve("node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", consultationFrontendPort()];
const child = spawn(command, args, {
  cwd: workspace === "ai" ? resolve("ai-service") : workspace === "frontend" ? resolve("frontend") : root,
  env: workspace === "ai" ? aiEnv : workspace === "backend" ? backendEnv : frontendEnv,
  stdio: "inherit",
  windowsHide: true,
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => child.kill(signal));
