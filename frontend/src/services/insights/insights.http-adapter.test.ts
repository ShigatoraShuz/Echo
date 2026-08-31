import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/api/supabase-auth-token-provider", () => ({
  supabaseAuthTokenProvider: {
    getAccessToken: vi.fn(async () => "access-token"),
    refreshAccessToken: vi.fn(async () => "access-token"),
    clearSession: vi.fn(async () => undefined),
  },
}));

describe("insights HTTP adapter", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://api.example.test/api/v1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("maps the backend emotion wheel into the full summary shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              emotionWheel: [
                { label: "Calm", mood: "calm", value: 40 },
                { label: "Anxious", mood: "anxious", value: 10 },
              ],
              moodTrend: [{ label: "Mon", value: 60 }],
              summary: "Calm is the most frequent signal.",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const { createInsightsHttpAdapter } = await import("@/services/insights/insights.http-adapter");
    const result = await createInsightsHttpAdapter().getEmotionSummary("30d");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.emotionWheel[0]).toMatchObject({ mood: "good", value: 40 });
      expect(result.data.positiveVsDifficult).toEqual({ positive: 40, difficult: 10 });
      expect(result.data.mostFrequentEmotions[0]).toEqual({ emotion: "Calm", count: 40 });
    }
    expect(fetch).toHaveBeenCalledWith(
      "http://api.example.test/api/v1/insights/emotions?range=30d",
      expect.any(Object),
    );
  });

});
