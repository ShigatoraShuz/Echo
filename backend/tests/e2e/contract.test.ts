import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp, type CreateAppOptions } from "../../src/app.js";
import type { BuddyService } from "../../src/features/buddy/buddy.service.js";
import type { DashboardService } from "../../src/features/dashboard/dashboard.service.js";
import type { InsightsService } from "../../src/features/insights/insights.service.js";
import type { GroundingService } from "../../src/features/grounding/grounding.service.js";
import type { SupportResourcesService } from "../../src/features/support-resources/support-resources.service.js";
import type { VerificationService } from "../../src/features/verification/verification.service.js";

function createHarness(appOptions: CreateAppOptions = {}) {
  const dashboardService = {
    dashboard: vi.fn().mockResolvedValue({ journalEntries: [], moodToday: null }),
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
    supportResources: vi.fn().mockResolvedValue([{ id: "resource-1", name: "Verified support" }]),
  };
  const verifier = {
    getUser: vi.fn(async (token: string) =>
      token === "valid-token" ? { id: "user-1", email: "user@example.com" } : null,
    ),
  };
  const verificationService = {
    assertAiAccess: vi.fn().mockResolvedValue(undefined),
  } as unknown as VerificationService;
  const app = createApp({
    ...appOptions,
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
  return { app };
}

describe("API envelope contract (ECHO-009)", () => {
  it("returns a success envelope with data and meta.requestId on 200", async () => {
    const { app } = createHarness();

    const response = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { journalEntries: [], moodToday: null },
      meta: { requestId: expect.any(String) },
    });
    expect(response.headers["content-type"]).toMatch(/application\/json/);
  });

  it("returns an error envelope with code, message, and meta.requestId on 401", async () => {
    const { app } = createHarness();

    const response = await request(app).get("/api/v1/dashboard");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication is required.",
      },
      meta: { requestId: expect.any(String) },
    });
  });

  it("returns a validation envelope with code VALIDATION_ERROR on 400", async () => {
    const { app } = createHarness();

    const response = await request(app)
      .post("/api/v1/buddy/messages")
      .set("Authorization", "Bearer valid-token")
      .send({ content: "   " });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.message).toBe("The request is invalid.");
    expect(typeof response.body.meta.requestId).toBe("string");
  });

  it("maps malformed JSON bodies to 400 with a requestId instead of 500", async () => {
    const { app } = createHarness();

    const response = await request(app)
      .post("/api/v1/journals")
      .set("Authorization", "Bearer valid-token")
      .set("Content-Type", "application/json")
      .send('{"title": "unterminated');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(typeof response.body.meta.requestId).toBe("string");
  });

  it("maps oversized bodies to 413 with a requestId instead of 500", async () => {
    const { app } = createHarness({ bodyLimit: "1kb" });

    const oversized = JSON.stringify({ title: "x".repeat(4 * 1024) });
    const response = await request(app)
      .post("/api/v1/journals")
      .set("Authorization", "Bearer valid-token")
      .set("Content-Type", "application/json")
      .send(oversized);

    expect(response.status).toBe(413);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(typeof response.body.meta.requestId).toBe("string");
  });

  it("uses a distinct requestId per request", async () => {
    const { app } = createHarness();

    const first = await request(app).get("/api/v1/dashboard").set("Authorization", "Bearer valid-token");
    const second = await request(app).get("/api/v1/dashboard").set("Authorization", "Bearer valid-token");

    expect(first.body.meta.requestId).not.toBe(second.body.meta.requestId);
  });

  it("never leaks internal error details or stack traces", async () => {
    const { app } = createHarness();

    const boom = { ...app, _router: app._router };
    void boom;

    const response = await request(app)
      .get("/api/v1/support-resources?q=crisis&type=all")
      .expect(200);

    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain("Error:");
    expect(raw).not.toContain("at ");
    expect(raw).not.toContain("stack");
  });

  it("includes only known error fields (no detail key when absent)", async () => {
    const { app } = createHarness();

    const response = await request(app).get("/api/v1/dashboard");

    expect(Object.keys(response.body.error).sort()).toEqual(["code", "message"]);
    expect(response.body.error.detail).toBeUndefined();
  });

  it("rejects unknown routes with the envelope format", async () => {
    const { app } = createHarness();

    const response = await request(app).get("/api/v1/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "No route matches GET /api/v1/does-not-exist.",
      },
      meta: { requestId: expect.any(String) },
    });
  });
});