import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/api/supabase-auth-token-provider", () => ({
  supabaseAuthTokenProvider: {
    getAccessToken: vi.fn(async () => "access-token"),
    refreshAccessToken: vi.fn(async () => "access-token"),
    clearSession: vi.fn(async () => undefined),
  },
}));

describe("support resources API", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://api.example.test/api/v1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("unwraps resources and sends encoded filters to the Gateway", async () => {
    const resource = {
      id: "resource-1",
      type: "crisis_hotline",
      organizationName: "Support Org",
      name: "Help line",
      description: "Immediate support",
      phoneNumber: "123",
      smsNumber: null,
      websiteUrl: null,
      availability: "24/7",
      countryCode: "PH",
      regionCode: null,
      lastVerifiedAt: "2026-08-01T00:00:00Z",
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: [resource] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { supportResourcesApi } = await import("./support-resources-api");
    await expect(supportResourcesApi.list({ query: "mental health", type: "crisis_hotline" })).resolves.toEqual([resource]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.example.test/api/v1/support-resources?q=mental+health&type=crisis_hotline",
      expect.any(Object),
    );
  });
});
