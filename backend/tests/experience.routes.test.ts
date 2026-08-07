import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { ExperienceService } from "../src/features/experience/experience.service.js";
import type { VerificationService } from "../src/features/verification/verification.service.js";
import { VerificationRequiredError } from "../src/shared/errors/app-error.js";

function createHarness(verified = true) {
  const service = {
    dashboard: vi.fn().mockResolvedValue({ journalEntries: [] }),
    buddySession: vi.fn().mockResolvedValue({ conversationId: "conversation-1", messages: [] }),
    sendBuddyMessage: vi.fn().mockResolvedValue({ conversationId: "conversation-1", messages: [] }),
    buddyHistory: vi.fn().mockResolvedValue([]),
    emotionInsights: vi.fn().mockResolvedValue({ emotionWheel: [], moodTrend: [], summary: "No entries." }),
    completeGrounding: vi.fn().mockResolvedValue({
      id: "session-1",
      completedAt: "2026-07-25T00:00:00.000Z",
      completedSessions: 1,
    }),
    supportResources: vi.fn().mockResolvedValue([{ id: "resource-1", name: "Verified support" }]),
  };
  const verifier = {
    getUser: vi.fn(async (token: string) =>
      token === "valid-token" ? { id: "user-1", email: "user@example.com" } : null,
    ),
  };
  const verificationService = {
    assertAiAccess: vi.fn().mockImplementation(async () => {
      if (!verified) throw new VerificationRequiredError("submitted");
    }),
  };
  const app = createApp({
    v1: {
      experience: {
        service: service as unknown as ExperienceService,
        verifier,
        verificationService: verificationService as unknown as VerificationService,
      },
    },
  });
  return { app, service, verificationService };
}

describe("experience routes", () => {
  it("keeps personal dashboard data behind Supabase authentication", async () => {
    const { app, service } = createHarness();

    const unauthenticated = await request(app).get("/api/v1/dashboard");
    expect(unauthenticated.status).toBe(401);

    const authenticated = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", "Bearer valid-token");
    expect(authenticated.status).toBe(200);
    expect(service.dashboard).toHaveBeenCalledWith("user-1");
  });

  it("serves only the public verified-support endpoint without authentication", async () => {
    const { app, service } = createHarness();
    const response = await request(app).get("/api/v1/support-resources?q=crisis&type=all");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([{ id: "resource-1", name: "Verified support" }]);
    expect(service.supportResources).toHaveBeenCalledWith("crisis", "all");
  });

  it("validates and forwards Buddy messages for the authenticated owner", async () => {
    const { app, service } = createHarness();

    const invalid = await request(app)
      .post("/api/v1/buddy/messages")
      .set("Authorization", "Bearer valid-token")
      .send({ content: "   " });
    expect(invalid.status).toBe(400);

    const valid = await request(app)
      .post("/api/v1/buddy/messages")
      .set("Authorization", "Bearer valid-token")
      .send({ content: "I feel overwhelmed." });
    expect(valid.status).toBe(201);
    expect(service.sendBuddyMessage).toHaveBeenCalledWith("user-1", "I feel overwhelmed.");
  });

  it("blocks Buddy until account verification is approved", async () => {
    const { app, service, verificationService } = createHarness(false);
    const response = await request(app)
      .get("/api/v1/buddy/session")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("VERIFICATION_REQUIRED");
    expect(response.body.error.details).toMatchObject({
      verificationStatus: "submitted",
      verificationPath: "/settings/verification",
    });
    expect(verificationService.assertAiAccess).toHaveBeenCalledWith("user-1");
    expect(service.buddySession).not.toHaveBeenCalled();
  });

  it("records a validated grounding completion", async () => {
    const { app, service } = createHarness();
    const response = await request(app)
      .post("/api/v1/grounding/sessions")
      .set("Authorization", "Bearer valid-token")
      .send({ technique: "box-breathing", durationSeconds: 120, pace: "gentle" });

    expect(response.status).toBe(201);
    expect(service.completeGrounding).toHaveBeenCalledWith("user-1", {
      technique: "box-breathing",
      durationSeconds: 120,
      pace: "gentle",
    });
  });
});
