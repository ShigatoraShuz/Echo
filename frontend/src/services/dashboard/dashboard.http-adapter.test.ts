import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/api/supabase-auth-token-provider", () => ({
  supabaseAuthTokenProvider: {
    getAccessToken: vi.fn(async () => "access-token"),
    refreshAccessToken: vi.fn(async () => "access-token"),
    clearSession: vi.fn(async () => undefined),
  },
}));

describe("dashboard HTTP adapter", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://api.example.test/api/v1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("loads the authenticated backend dashboard and maps journal DTOs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              userProfile: {
                name: "Mira",
                streakDays: 1,
                nextCheckIn: "20:00",
                privacyStatus: "Private",
              },
              latestEntry: null,
              journalEntries: [
                {
                  id: "entry-1",
                  title: "A quiet minute",
                  body: "I slowed down.",
                  excerpt: "I slowed down.",
                  mood: "calm",
                  emotions: ["steady"],
                  tags: ["evening"],
                  privacy_status: "private",
                  analysis_consent: false,
                  risk_score: 0,
                  risk_band: "low",
                  summary: "No analysis.",
                  perspective: null,
                  created_at: "2026-07-25T00:00:00.000Z",
                  updated_at: "2026-07-25T00:00:00.000Z",
                },
              ],
              moodTrend: [{ label: "Sat", value: 82 }],
              riskTrend: [{ label: "Sat", value: 18 }],
              weeklyDigest: ["One reflection saved."],
              quickActions: [],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const { createDashboardHttpAdapter } = await import("@/services/dashboard/dashboard.http-adapter");
    const result = await createDashboardHttpAdapter().getDashboardData();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.journalEntries[0]).toMatchObject({
        id: "entry-1",
        privacyStatus: "private",
        createdAt: "2026-07-25T00:00:00.000Z",
      });
    }
    expect(fetch).toHaveBeenCalledWith(
      "http://api.example.test/api/v1/dashboard",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
  });

  it("sends the selected dashboard range", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: { userProfile: { name: "Mira", streakDays: 0, nextCheckIn: "Any time", privacyStatus: "Private" }, latestEntry: null, journalEntries: [], moodTrend: [], riskTrend: [], weeklyDigest: [], quickActions: [] },
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const { createDashboardHttpAdapter } = await import("@/services/dashboard/dashboard.http-adapter");
    await createDashboardHttpAdapter().getDashboardData("90d");
    expect(fetch).toHaveBeenCalledWith("http://api.example.test/api/v1/dashboard?range=90d", expect.any(Object));
  });
});
