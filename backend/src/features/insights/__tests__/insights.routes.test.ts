import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import type { InsightsService } from "../insights.service.js";

function createHarness() {
  const service = {
    emotionInsights: vi.fn().mockResolvedValue({
      emotionWheel: [],
      moodTrend: [],
      summary: "No entries.",
    }),
  };
  const verifier = {
    getUser: vi.fn(async (token: string) =>
      token === "valid-token" ? { id: "user-1", email: "user@example.com" } : null,
    ),
  };
  const app = createApp({
    v1: {
      insights: {
        service: service as unknown as InsightsService,
        verifier,
      },
    },
  });
  return { app, service };
}

describe("insights routes", () => {
  it("serves emotion insights for authenticated users", async () => {
    const { app, service } = createHarness();
    const response = await request(app)
      .get("/api/v1/insights/emotions")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      emotionWheel: [],
      moodTrend: [],
      summary: "No entries.",
    });
    expect(service.emotionInsights).toHaveBeenCalledWith("user-1");
  });
});

