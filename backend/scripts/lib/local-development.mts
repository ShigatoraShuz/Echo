/** Private local settings, independent of test fixture files after one-time key adoption. */
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { FIXTURE_TAG, LOCAL_API, localEnvironment, localSql } from "./professional-local-target.mts";
import { localGoogleConfiguration } from "./local-google-configuration.mts";

export function developmentConfiguration(root: string) {
  if (process.env.NODE_ENV === "production") throw new Error("npm run dev is local development only.");
  const local = localEnvironment(root);
  const directory = resolve(root, "backend/.local-development");
  const path = resolve(directory, "private.json");
  if (!existsSync(path)) {
    const legacyPath = resolve(root, "backend/tmp/professional-fixtures/state.json");
    let encryptionKey: string, registrationSecret: string;
    if (existsSync(legacyPath)) {
      const old = JSON.parse(readFileSync(legacyPath, "utf8"));
      if (old.tag !== FIXTURE_TAG || old.fingerprint !== local.fingerprint || !old.complete || old.retired)
        throw new Error("Existing local encryption-key source does not match this database; no keys replaced.");
      encryptionKey = old.encryptionKey; registrationSecret = old.registrationSecret;
    } else {
      // Never generate a replacement key over an existing encrypted local account database.
      if (localSql("select count(*) from auth.users;") !== "0")
        throw new Error("Existing local users require their original encryption/sign-up keys. Restore backend/.local-development/private.json; no keys or data changed.");
      encryptionKey = randomBytes(32).toString("base64"); registrationSecret = randomBytes(48).toString("hex");
    }
    mkdirSync(directory, { recursive: true });
    writeFileSync(path, JSON.stringify({ schemaVersion: "echo-local-development-v1", fingerprint: local.fingerprint, encryptionKey, registrationSecret }), { flag: "wx", mode: 0o600 });
  }
  const settings = JSON.parse(readFileSync(path, "utf8"));
  if (settings.schemaVersion !== "echo-local-development-v1" || settings.fingerprint !== local.fingerprint ||
    Buffer.from(settings.encryptionKey ?? "", "base64").length !== 32 || typeof settings.registrationSecret !== "string" || settings.registrationSecret.length < 32)
    throw new Error("Local private settings are invalid or belong to another database; no data changed.");
  // Adopt previously authorized synthetic actors once. Later enrollment is a local
  // operator's explicit fictional-data attestation, not an Auth role/metadata grant.
  if (!Array.isArray(settings.userIds)) {
    settings.userIds = JSON.parse(localSql(`select coalesce(json_agg(id order by id),'[]') from auth.users
      where raw_app_meta_data->>'fixture'='echo-professional-local-v1'
      and raw_app_meta_data->>'consultation_demo'='true' and email like '%@professional.echo.test';`));
    writeFileSync(path, JSON.stringify(settings), { mode: 0o600 });
  }
  const users = settings.userIds as string[];
  if (users.some(id => !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)))
    throw new Error("Invalid explicitly authorized local account UUID.");
  if (!users.length || users.length > 20) throw new Error("Local research requires 1–20 already authorized fictional local test users. Ordinary accounts cannot run provisional models; no accounts or roles created.");
  const active = JSON.parse(readFileSync(resolve(root, "backend/models/.local/active.json"), "utf8"));
  if (active.schemaVersion !== "echo-local-model-selection-v1" || !active.tasks || !Object.keys(active.tasks).length)
    throw new Error("Select installed checkpoints using npm run models:activate before startup.");
  const { researchDiagnostic = "", ...tasks } = active.tasks as Record<string, string>;
  const google = localGoogleConfiguration(resolve(root, "frontend"));
  if (process.env.ECHO_ACTIVE_MODELS && process.env.ECHO_ACTIVE_MODELS !== JSON.stringify(tasks))
    throw new Error("ECHO_ACTIVE_MODELS conflicts with local selection. Clear that shell variable and use npm run models:activate.");
  const secret = (purpose: string) => createHmac("sha256", settings.registrationSecret).update(purpose).digest("hex");
  const common = { ...process.env, NODE_ENV: "development", HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1", HF_HUB_DISABLE_TELEMETRY: "1" };
  const ai = {
    ...common, APP_ENV: "development", AI_SERVICE_TOKEN: secret("model-service-v1"),
    ECHO_LOCAL_RESEARCH: "true", ECHO_CONSULTATION_DEMO: "false", ECHO_EXECUTION_MODE: "real",
    ECHO_MODELS_DIR: resolve(root, "backend/models"), ECHO_ACTIVE_MODELS: JSON.stringify(tasks),
    ECHO_RESEARCH_DIAGNOSTIC_ID: researchDiagnostic, ECHO_DIAGNOSTIC_MODELS_DIR: resolve(root, "backend/models"),
    ECHO_STAGE_TIMEOUT_SECONDS: "120", MAX_NEW_TOKENS: "256",
  };
  const backend = {
    ...common, PORT: "4300", FRONTEND_URL: "http://127.0.0.1:3000", SUPABASE_URL: LOCAL_API,
    SUPABASE_PUBLISHABLE_KEY: local.anonKey, SUPABASE_SERVICE_ROLE_KEY: local.serviceKey,
    JOURNAL_ENCRYPTION_KEY_BASE64: settings.encryptionKey, JOURNAL_ENCRYPTION_KEY_VERSION: "1", ENCRYPTION_PREVIOUS_KEYS_JSON: "{}",
    SIGNUP_DRAFT_SECRET: settings.registrationSecret, IDEMPOTENCY_HMAC_ACTIVE_VERSION: "model-local-v1",
    IDEMPOTENCY_HMAC_KEYS_JSON: JSON.stringify({ "model-local-v1": secret("model-idempotency-v1") }),
    AI_ANALYSIS_MODE: "local_worker", AI_WORKER_TOKEN: secret("model-worker-v1"), AI_HTTP_BRIDGE_ENABLED: "true",
    AI_LOCAL_RESEARCH: "true", AI_CONSULTATION_DEMO: "false", AI_CONSULTATION_RESPONDER: "model",
    AI_SERVICE_ORIGIN: "http://127.0.0.1:8100", AI_SERVICE_TOKEN: secret("model-service-v1"), AI_EXECUTION_MODE: "real",
    AI_DEVELOPMENT_USER_IDS: users.join(","), AI_JOB_TIMEOUT_MS: "180000", ECHO_HTTP_ONLY_MODE: "1",
    PROFESSIONAL_EVENTS_ENABLED: "false", EMAIL_PROVIDER: "disabled", RESEND_API_KEY: "", SMTP_PASSWORD: "",
    PUSH_VAPID_PUBLIC_KEY: "", PUSH_VAPID_PRIVATE_KEY: "", PUSH_VAPID_SUBJECT: "", GOOGLE_WEB_CLIENT_ID: google.GOOGLE_WEB_CLIENT_ID,
  };
  const frontend = {
    ...common, NEXT_PUBLIC_SUPABASE_URL: LOCAL_API, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.anonKey,
    NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:4300/api/v1", GATEWAY_API_BASE_URL: "http://127.0.0.1:4300/api/v1",
    NEXT_PUBLIC_DATA_ADAPTER: "http", NEXT_PUBLIC_GOOGLE_CLIENT_ID: google.NEXT_PUBLIC_GOOGLE_CLIENT_ID, NEXT_DIST_DIR: ".next-model-integration",
  };
  return { local, ai, backend, frontend, tasks, researchDiagnostic, secret };
}
