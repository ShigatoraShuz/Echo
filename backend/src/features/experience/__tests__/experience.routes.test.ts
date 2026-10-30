import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import type { ExperienceService } from "../experience.service.js";
import type { VerificationService } from "../../verification/verification.service.js";
import { VerificationRequiredError } from "../../../shared/errors/app-error.js";

function createHarness(verified = true) {
  const service = {
    dashboard: vi.fn().mockResolvedValue({ journalEntries: [] }),
    buddySession: vi.fn().mockResolvedValue({ conversationId: "conversation-1", messages: [] }),
    sendBuddyMessage: vi.fn().mockResolvedValue({ conversationId: "conversation-1", messages: [] }),
    buddyHistory: vi.fn().mockResolvedValue([]),
    buddyPrivacy: vi.fn().mockResolvedValue({ buddyHistoryEnabled: true }),
    createBuddyConversation: vi.fn().mockResolvedValue({ id: "conversation-1" }),
    renameBuddyConversation: vi.fn().mockResolvedValue({ id: "conversation-1", title: "Updated" }),
    deleteBuddyConversation: vi.fn().mockResolvedValue({ deleted: true }),
    pinBuddyConversation: vi.fn().mockResolvedValue({ id: "conversation-1", pinned_at: "2026-10-12T00:00:00Z" }),
    emotionInsights: vi.fn().mockResolvedValue({ emotionWheel: [], moodTrend: [], summary: "No entries." }),
    completeGrounding: vi.fn().mockResolvedValue({
      id: "session-1",
      completedAt: "2026-07-25T00:00:00.000Z",
      completedSessions: 1,
    }),
    groundingHistory: vi.fn().mockResolvedValue([{ id: "session-1", type: "box-breathing", duration: 120, pace: "gentle", completedAt: "2026-07-25T00:00:00.000Z" }]),
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
    expect(service.supportResources).toHaveBeenCalledWith("crisis", "all", "PH");
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
    expect(service.sendBuddyMessage).toHaveBeenCalledWith("user-1", "I feel overwhelmed.", undefined, undefined);
  });

  it("opens and pins only a validated conversation id through the authenticated route", async () => {
    const { app, service } = createHarness();
    const id = "1db44bd7-fd60-468a-abdb-d97972d4650a";
    const invalid = await request(app).get("/api/v1/buddy/conversations/not-a-uuid").set("Authorization", "Bearer valid-token");
    expect(invalid.status).toBe(400);
    const opened = await request(app).get(`/api/v1/buddy/conversations/${id}`).set("Authorization", "Bearer valid-token");
    expect(opened.status).toBe(200);
    expect(service.buddySession).toHaveBeenCalledWith("user-1", id);
    const pinned = await request(app).put(`/api/v1/buddy/conversations/${id}/pin`).set("Authorization", "Bearer valid-token").send({ pinned: true });
    expect(pinned.status).toBe(200);
    expect(service.pinBuddyConversation).toHaveBeenCalledWith("user-1", id, true);
  });

  it("creates, renames, and deletes only through authenticated Buddy routes", async () => {
    const { app, service } = createHarness();
    const id = "1db44bd7-fd60-468a-abdb-d97972d4650a";
    expect((await request(app).post("/api/v1/buddy/conversations")).status).toBe(401);
    const created = await request(app).post("/api/v1/buddy/conversations").set("Authorization", "Bearer valid-token").send({});
    expect(created.status).toBe(201);
    expect(service.createBuddyConversation).toHaveBeenCalledWith("user-1");
    const invalid = await request(app).patch(`/api/v1/buddy/conversations/${id}`).set("Authorization", "Bearer valid-token").send({ title: " " });
    expect(invalid.status).toBe(400);
    const renamed = await request(app).patch(`/api/v1/buddy/conversations/${id}`).set("Authorization", "Bearer valid-token").send({ title: " Updated " });
    expect(renamed.status).toBe(200);
    expect(service.renameBuddyConversation).toHaveBeenCalledWith("user-1", id, "Updated");
    const deleted = await request(app).delete(`/api/v1/buddy/conversations/${id}`).set("Authorization", "Bearer valid-token");
    expect(deleted.status).toBe(200);
    expect(service.deleteBuddyConversation).toHaveBeenCalledWith("user-1", id);
  });

  it("validates Buddy history pagination before loading owner data", async () => {
    const { app, service } = createHarness();
    const invalid = await request(app).get("/api/v1/buddy/history?pageSize=500").set("Authorization", "Bearer valid-token");
    expect(invalid.status).toBe(400);
    expect(service.buddyHistory).not.toHaveBeenCalled();

    const valid = await request(app).get("/api/v1/buddy/history?page=2&pageSize=20&query=calm").set("Authorization", "Bearer valid-token");
    expect(valid.status).toBe(200);
    expect(service.buddyHistory).toHaveBeenCalledWith("user-1", { page: 2, pageSize: 20, query: "calm" });
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

  it("accepts a reusable session ID for safe grounding retries", async () => {
    const { app, service } = createHarness();
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const response = await request(app)
      .post("/api/v1/grounding/sessions")
      .set("Authorization", "Bearer valid-token")
      .send({ sessionId, technique: "box-breathing", durationSeconds: 120, pace: "gentle" });

    expect(response.status).toBe(201);
    expect(service.completeGrounding).toHaveBeenCalledWith("user-1", {
      sessionId, technique: "box-breathing", durationSeconds: 120, pace: "gentle",
    });
  });

  it("loads grounding history only for the authenticated owner", async () => {
    const { app, service } = createHarness();
    expect((await request(app).get("/api/v1/grounding/sessions")).status).toBe(401);
    const response = await request(app).get("/api/v1/grounding/sessions").set("Authorization", "Bearer valid-token");
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(service.groundingHistory).toHaveBeenCalledWith("user-1");
  });

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
