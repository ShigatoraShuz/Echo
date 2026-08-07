import { describe, expect, it } from "vitest";
import { loadEnvironment } from "../../src/config/environment.js";

const validEnvironment = {
  NODE_ENV: "test",
  FRONTEND_URL: "http://localhost:3000",
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
  JOURNAL_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 3).toString("base64"),
  JOURNAL_ENCRYPTION_KEY_VERSION: "1",
  ANALYSIS_PROVIDER: "mock",
  ALLOW_MOCK_ANALYSIS: "true",
};

describe("backend environment", () => {
  it("validates a non-production mock-analysis configuration", () => {
    expect(loadEnvironment(validEnvironment).ANALYSIS_PROVIDER).toBe("mock");
  });

  it("rejects invalid keys and mock analysis in production", () => {
    expect(() => loadEnvironment({ ...validEnvironment, JOURNAL_ENCRYPTION_KEY_BASE64: "invalid" })).toThrow();
    expect(() => loadEnvironment({ ...validEnvironment, NODE_ENV: "production" })).toThrow("Mock analysis");
  });
});
