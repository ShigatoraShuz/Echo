import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

describe("featureFlags", () => {
  it("returns true for valid boolean env vars set to 'true'", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_BUDDY", "true");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://test.com");
    const { featureFlags } = await import("./feature-flags.config");
    expect(featureFlags.buddy).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns false for invalid boolean values", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_BUDDY", "invalid");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://test.com");
    const { featureFlags } = await import("./feature-flags.config");
    expect(featureFlags.buddy).toBe(false);
    vi.unstubAllEnvs();
  });

  it("returns false for '0' values", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_BUDDY", "0");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://test.com");
    const { featureFlags } = await import("./feature-flags.config");
    expect(featureFlags.buddy).toBe(false);
    vi.unstubAllEnvs();
  });

  it("mock mode does not require API base URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCK", "true");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const { env } = await import("../config/environment");
    expect(env.dataAdapter).toBe("mock");
    vi.unstubAllEnvs();
  });
});
