import { expect, it } from "vitest";
import { loadEnvironment } from "../environment.js";

const base = {
  NODE_ENV: "test", FRONTEND_URL: "http://localhost:3000",
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_PUBLISHABLE_KEY: "synthetic-test-key",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-test-key",
  JOURNAL_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 3).toString("base64"),
  IDEMPOTENCY_HMAC_KEYS_JSON: JSON.stringify({ v1: "synthetic-idempotency-secret-32-characters" }),
};

it("preserves the standard application configuration", () => {
  expect(loadEnvironment(base).AI_ANALYSIS_MODE).toBe("disabled");
});

it.each([
  { ECHO_REALTIME_TALK: "true" },
  { AI_ANALYSIS_MODE: "local_json" },
  { AI_SERVICE_URL: "http://127.0.0.1:8000", AI_SERVICE_TOKEN: "x".repeat(32) },
  { AI_ANALYSIS_MODE: "local_worker", AI_WORKER_TOKEN: "x".repeat(32),
    AI_SERVICE_URL: "http://127.0.0.1:8000", AI_SERVICE_TOKEN: "x".repeat(32) },
])("quarantines unapproved core-backed persistence: %j", (settings) => {
  expect(() => loadEnvironment({ ...base, ...settings })).toThrow("pending privacy approval");
});

const approved = {
  NODE_ENV: "development", ECHO_HTTP_ONLY_MODE: "1",
  AI_CORE_PROFILE: "local_encrypted_worker", AI_ANALYSIS_MODE: "local_worker",
  AI_WORKER_TOKEN: "w".repeat(32), AI_SERVICE_URL: "http://127.0.0.1:8000",
  AI_SERVICE_TOKEN: "s".repeat(32),
};
it("permits only the explicitly selected local encrypted worker profile", () => {
  expect(loadEnvironment({ ...base, ...approved }).AI_CORE_PROFILE).toBe("local_encrypted_worker");
});
it.each([
  { SUPABASE_URL: "https://example.supabase.co" }, { NODE_ENV: "production" },
  { AI_ANALYSIS_MODE: "local_json" }, { AI_WORKER_TOKEN: undefined },
  { AI_SERVICE_URL: undefined }, { SUPABASE_URL: "http://127.0.0.1.example.com" },
  { ECHO_HTTP_ONLY_MODE: undefined },
])("denies hosted or incomplete encrypted profiles: %j", settings => {
  expect(() => loadEnvironment({ ...base, ...approved, ...settings })).toThrow();
});
