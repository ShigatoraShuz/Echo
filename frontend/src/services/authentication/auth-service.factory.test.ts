import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabasePublicConfig: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/config", () => ({
  getSupabasePublicConfig: mocks.getSupabasePublicConfig,
}));

vi.mock("./auth.mock-adapter", () => ({
  createAuthMockAdapter: () => ({ kind: "mock" }),
}));

vi.mock("./auth.supabase-adapter", () => ({
  createAuthSupabaseAdapter: () => ({ kind: "supabase" }),
}));

vi.mock("./auth.http-adapter", () => ({
  createAuthHttpAdapter: () => ({ kind: "http" }),
}));

describe("getAuthService adapter selection", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mocks.getSupabasePublicConfig.mockReset();
  });

  it("selects the mock adapter in mock data-adapter mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "mock");
    mocks.getSupabasePublicConfig.mockReturnValue({ url: "https://x.supabase.co", publishableKey: "pk" });

    const { getAuthService } = await import("@/services/authentication/auth-service.factory");
    expect(getAuthService()).toEqual({ kind: "mock" });
  });

  it("selects the Supabase adapter when configured in http mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "http");
    mocks.getSupabasePublicConfig.mockReturnValue({ url: "https://x.supabase.co", publishableKey: "pk" });

    const { getAuthService } = await import("@/services/authentication/auth-service.factory");
    expect(getAuthService()).toEqual({ kind: "supabase" });
  });

  it("selects the http adapter in non-production when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "http");
    mocks.getSupabasePublicConfig.mockReturnValue(null);

    const { getAuthService } = await import("@/services/authentication/auth-service.factory");
    expect(getAuthService()).toEqual({ kind: "http" });
  });

  it("returns an unavailable service in production without an identity provider", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "http");
    vi.stubEnv("NODE_ENV", "production");
    mocks.getSupabasePublicConfig.mockReturnValue(null);

    const { getAuthService } = await import("@/services/authentication/auth-service.factory");
    const service = getAuthService();

    const result = await service.login({
      email: "mira@test.com",
      password: "password123",
      rememberSession: false,
    });
    expect(result).toEqual({
      success: false,
      error: { code: "UNKNOWN", message: "Authentication is not configured. Contact the application administrator." },
    });
  });

  it("returns the same instance across calls until reset", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_ADAPTER", "mock");

    const factory = await import("@/services/authentication/auth-service.factory");
    const first = factory.getAuthService();
    expect(factory.getAuthService()).toBe(first);

    factory.resetAuthService();
    expect(factory.getAuthService()).not.toBe(first);
  });
});