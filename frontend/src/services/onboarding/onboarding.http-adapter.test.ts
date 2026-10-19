import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/api/supabase-auth-token-provider", () => ({
  supabaseAuthTokenProvider: {
    getAccessToken: vi.fn(async () => "access-token"),
    refreshAccessToken: vi.fn(async () => "access-token"),
    clearSession: vi.fn(async () => undefined),
  },
}));

describe("onboarding HTTP adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the user's camera consent to the setup endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, data: {} }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));

    const { createOnboardingHttpAdapter } = await import("./onboarding.http-adapter");
    const result = await createOnboardingHttpAdapter().saveSetup({
      theme: "system",
      notifications: false,
      facialAnalysis: true,
    });

    expect(result.success).toBe(true);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("/onboarding/setup");
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      notifications: false,
      facialAnalysis: true,
    });
  });
});
