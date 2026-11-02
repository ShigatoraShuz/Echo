import { describe, expect, it } from "vitest";
import { loadEnvironment } from "../environment.js";

const validEnvironment = {
  NODE_ENV: "test",
  FRONTEND_URL: "http://localhost:3000",
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
  JOURNAL_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 3).toString("base64"),
  JOURNAL_ENCRYPTION_KEY_VERSION: "1",
  AI_ANALYSIS_MODE: "development_stub",
  IDEMPOTENCY_HMAC_KEYS_JSON: JSON.stringify({ v1: "test-idempotency-secret-32-characters-long" }),
};

describe("backend environment", () => {
  it("requires explicit Professional worker opt-in and rejects ambiguous flags", () => {
    expect(loadEnvironment(validEnvironment).PROFESSIONAL_EVENTS_ENABLED).toBe(false);
    expect(loadEnvironment({ ...validEnvironment, PROFESSIONAL_EVENTS_ENABLED: "true" }).PROFESSIONAL_EVENTS_ENABLED).toBe(true);
    expect(() => loadEnvironment({ ...validEnvironment, PROFESSIONAL_EVENTS_ENABLED: "1" })).toThrow("PROFESSIONAL_EVENTS_ENABLED");
  });
  it("validates a non-production mock-analysis configuration", () => {
    expect(loadEnvironment(validEnvironment).AI_ANALYSIS_MODE).toBe("development_stub");
  });

  it("rejects invalid keys and mock analysis in production", () => {
    expect(() => loadEnvironment({ ...validEnvironment, JOURNAL_ENCRYPTION_KEY_BASE64: "invalid" })).toThrow();
    expect(() => loadEnvironment({ ...validEnvironment, NODE_ENV: "production" })).toThrow("Development stub");
  });

  it("keeps production analysis disabled until the separate model safety release gate", () => {
    const production = { ...validEnvironment, NODE_ENV: "production", FRONTEND_URL: "https://echo.example.test",
      SUPABASE_URL: "https://project.supabase.co", SIGNUP_DRAFT_SECRET: "s".repeat(32), AI_ANALYSIS_MODE: "disabled" };
    expect(loadEnvironment(production).AI_ANALYSIS_MODE).toBe("disabled");
    expect(() => loadEnvironment({ ...production, AI_ANALYSIS_MODE: "local_worker", AI_WORKER_TOKEN: "w".repeat(32) }))
      .toThrow("model safety release gate");
    expect(() => loadEnvironment({ ...production, AI_DEVELOPMENT_USER_IDS: "e0000000-0000-4000-8000-000000000001" }))
      .toThrow("model safety release gate");
  });

  it("requires a verified sender and SMTP credentials before enabling email alerts", () => {
    expect(() => loadEnvironment({ ...validEnvironment, EMAIL_PROVIDER: "smtp" })).toThrow("EMAIL_FROM");
    expect(() => loadEnvironment({
      ...validEnvironment, EMAIL_PROVIDER: "smtp", EMAIL_FROM: "alerts@example.test",
    })).toThrow("SMTP_HOST, SMTP_USER and SMTP_PASSWORD");
    expect(loadEnvironment({
      ...validEnvironment, EMAIL_PROVIDER: "smtp", EMAIL_FROM: "alerts@example.test",
      SMTP_HOST: "smtp.example.test", SMTP_USER: "sender", SMTP_PASSWORD: "test-password",
    }).EMAIL_PROVIDER).toBe("smtp");
  });
  it("requires an authenticated HTTPS or loopback document scanner", () => {
    expect(() => loadEnvironment({ ...validEnvironment, VERIFICATION_SCANNER_URL: "https://scan.example.test/inspect" })).toThrow();
    expect(() => loadEnvironment({ ...validEnvironment, VERIFICATION_SCANNER_URL: "http://scan.example.test/inspect", VERIFICATION_SCANNER_TOKEN: "x".repeat(32) })).toThrow();
    expect(loadEnvironment({ ...validEnvironment, VERIFICATION_SCANNER_URL: "http://127.0.0.1:8080/inspect", VERIFICATION_SCANNER_TOKEN: "x".repeat(32) }).VERIFICATION_SCANNER_URL).toBe("http://127.0.0.1:8080/inspect");
  });
  it("limits Windows Defender scanning to an explicitly configured local backend", () => {
    expect(() => loadEnvironment({ ...validEnvironment, VERIFICATION_SCANNER_MODE: "windows_defender" })).toThrow();
    if (process.platform === "win32")
      expect(loadEnvironment({ ...validEnvironment, VERIFICATION_SCANNER_MODE: "windows_defender", VERIFICATION_PDFINFO_PATH: "C:\\tools\\pdfinfo.exe" }).VERIFICATION_SCANNER_MODE).toBe("windows_defender");
  });
});

describe("hosted native development scope", () => {
  const hosted = { ...validEnvironment, NODE_ENV: "development", ECHO_HTTP_ONLY_MODE: "1",
    AI_CORE_PROFILE: "hosted_encrypted_worker", AI_ANALYSIS_MODE: "local_worker",
    SUPABASE_URL: "https://scoped-test.supabase.co", AI_HOSTED_PROJECT_REF: "scoped-test",
    AI_DEVELOPMENT_USER_IDS: "e0000000-0000-4000-8000-000000000001", AI_NATIVE_CREATED_AFTER: "2026-11-01T00:00:00Z",
    AI_SERVICE_URL: "http://127.0.0.1:8002", AI_WORKER_TOKEN: "w".repeat(48), AI_SERVICE_TOKEN: "s".repeat(48) };
  it("accepts the explicit hosted scope and preserves encryption configuration", () => {
    expect(loadEnvironment(hosted).JOURNAL_ENCRYPTION_KEY_BASE64).toBe(validEnvironment.JOURNAL_ENCRYPTION_KEY_BASE64);
  });
  it.each([
    { AI_HOSTED_PROJECT_REF: "another-project" }, { AI_DEVELOPMENT_USER_IDS: "" },
    { AI_DEVELOPMENT_USER_IDS: "------------------------------------" }, { AI_NATIVE_CREATED_AFTER: "invalid" },
    { AI_NATIVE_CREATED_AFTER: undefined }, { NODE_ENV: "production" }, { ECHO_HTTP_ONLY_MODE: "0" },
    { AI_CORE_PROFILE: "local_encrypted_worker" }, { AI_SERVICE_URL: "https://external.example.test" },
  ])("rejects invalid/unscoped native configuration: %j", override => {
    expect(() => loadEnvironment({ ...hosted, ...override })).toThrow();
  });
});
