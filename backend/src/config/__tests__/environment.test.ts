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
