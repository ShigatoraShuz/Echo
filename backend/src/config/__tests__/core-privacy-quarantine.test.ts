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
