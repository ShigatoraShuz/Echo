import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import type { BuddyService } from "../../src/features/buddy/buddy.service.js";
import type { DashboardService } from "../../src/features/dashboard/dashboard.service.js";
import type { InsightsService } from "../../src/features/insights/insights.service.js";
import type { GroundingService } from "../../src/features/grounding/grounding.service.js";
import type { SupportResourcesService } from "../../src/features/support-resources/support-resources.service.js";
import type { VerificationService } from "../../src/features/verification/verification.service.js";

interface VerifierStub {
  getUser: ReturnType<typeof vi.fn>;
}

function createHarness(verifier: VerifierStub) {
  const dashboardService = {
    dashboard: vi.fn().mockResolvedValue({ journalEntries: [] }),
  };
  const buddyService = {
    buddySession: vi.fn().mockResolvedValue({ conversationId: "conversation-1", messages: [] }),
    sendBuddyMessage: vi.fn().mockResolvedValue({ conversationId: "conversation-1", messages: [] }),
    buddyHistory: vi.fn().mockResolvedValue([]),
  };
  const insightsService = {
    emotionInsights: vi.fn().mockResolvedValue({ emotionWheel: [], moodTrend: [], summary: "No entries." }),
  };
  const groundingService = {
    completeGrounding: vi.fn().mockResolvedValue({
      id: "session-1",
      completedAt: "2026-07-25T00:00:00.000Z",
      completedSessions: 1,
    }),
  };
  const supportResourcesService = {
    supportResources: vi.fn().mockResolvedValue([]),
  };
  const verificationService = {
    assertAiAccess: vi.fn().mockResolvedValue(undefined),
  } as unknown as VerificationService;
  const service = { ...dashboardService, ...buddyService, ...insightsService, ...groundingService, ...supportResourcesService };
  const app = createApp({
    v1: {
      buddy: {
        service: buddyService as unknown as BuddyService,
        verifier,
        verificationService,
      },
      dashboard: {
        service: dashboardService as unknown as DashboardService,
        verifier,
      },
      insights: {
        service: insightsService as unknown as InsightsService,
        verifier,
      },
      grounding: {
        service: groundingService as unknown as GroundingService,
        verifier,
      },
      supportResources: {
        service: supportResourcesService as unknown as SupportResourcesService,
      },
    },
  });
  return { app, service };
}

const PROTECTED_ROUTES: Array<[string, string]> = [
  ["GET", "/api/v1/dashboard"],
  ["GET", "/api/v1/buddy/session"],
  ["POST", "/api/v1/buddy/messages"],
  ["GET", "/api/v1/buddy/history"],
  ["GET", "/api/v1/insights/emotions"],
  ["POST", "/api/v1/grounding/sessions"],
];

describe("auth fail-closed (ECHO-011)", () => {
  it("rejects requests without an Authorization header", async () => {
    const { app, service } = createHarness({ getUser: vi.fn() });

    const response = await request(app).get("/api/v1/dashboard");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    expect(service.dashboard).not.toHaveBeenCalled();
  });

  it("rejects a non-Bearer authorization scheme", async () => {
    const { app, service } = createHarness({ getUser: vi.fn() });

    const response = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", "Basic dXNlcjpwYXNz");

    expect(response.status).toBe(401);
    expect(service.dashboard).not.toHaveBeenCalled();
  });

  it("rejects an empty Bearer token", async () => {
    const { app, service } = createHarness({ getUser: vi.fn() });

    const response = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", "Bearer ");

    expect(response.status).toBe(401);
    expect(service.dashboard).not.toHaveBeenCalled();
  });

  it("rejects an invalid token without calling the service", async () => {
    const verifier = { getUser: vi.fn().mockResolvedValue(null) };
    const { app, service } = createHarness(verifier);

    const response = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", "Bearer not-a-real-token");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_ACCESS_TOKEN");
    expect(verifier.getUser).toHaveBeenCalledWith("not-a-real-token");
    expect(service.dashboard).not.toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    const verifier = { getUser: vi.fn().mockResolvedValue(null) };
    const { app, service } = createHarness(verifier);

    const response = await request(app)
      .get("/api/v1/buddy/session")
      .set("Authorization", "Bearer expired-token");

    expect(response.status).toBe(401);
    expect(service.buddySession).not.toHaveBeenCalled();
  });

  it("rejects a wrong-audience token", async () => {
    const verifier = { getUser: vi.fn().mockResolvedValue(null) };
    const { app, service } = createHarness(verifier);

    const response = await request(app)
      .get("/api/v1/insights/emotions")
      .set("Authorization", "Bearer token-for-another-project");

    expect(response.status).toBe(401);
    expect(service.emotionInsights).not.toHaveBeenCalled();
  });

  it("fails closed (401) when the verifier itself errors", async () => {
    const verifier = { getUser: vi.fn().mockRejectedValue(new Error("supabase outage")) };
    const { app, service } = createHarness(verifier);

    const response = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", "Bearer valid-looking-token");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_ACCESS_TOKEN");
    expect(service.dashboard).not.toHaveBeenCalled();
  });

  it("trims whitespace around the token before verification", async () => {
    const verifier = {
      getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "user@example.com" }),
    };
    const { app, service } = createHarness(verifier);

    const response = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", "Bearer valid-token   ");

    expect(response.status).toBe(200);
    expect(verifier.getUser).toHaveBeenCalledWith("valid-token");
    expect(service.dashboard).toHaveBeenCalledWith("user-1");
  });

  it("applies fail-closed consistently across every protected route", async () => {
    const { app } = createHarness({ getUser: vi.fn().mockResolvedValue(null) });

    for (const [method, path] of PROTECTED_ROUTES) {
      const response = await request(app)[method.toLowerCase() as "get" | "post"](path);
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    }
  });

  it("leaves the public support-resources endpoint open", async () => {
    const { app } = createHarness({ getUser: vi.fn() });

    const response = await request(app).get("/api/v1/support-resources?q=crisis&type=all");

    expect(response.status).toBe(200);
  });
});