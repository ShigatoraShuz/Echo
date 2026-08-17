import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import type { JournalService } from "../../src/features/journals/journals.service.js";
import type { SettingsService } from "../../src/features/settings/settings.service.js";
import type { ExperienceService } from "../../src/features/experience/experience.service.js";
import type { VerificationService } from "../../src/features/verification/verification.service.js";

function createHarness() {
  const verifier = {
    getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "user@example.com" }),
  };
  const journals = {
    list: vi.fn().mockResolvedValue({ entries: [] }),
    get: vi.fn().mockResolvedValue({ id: "entry-1" }),
    create: vi.fn().mockResolvedValue({ id: "entry-1" }),
    update: vi.fn().mockResolvedValue({ id: "entry-1" }),
    remove: vi.fn().mockResolvedValue(undefined),
    saveDraft: vi.fn().mockResolvedValue({}),
    getDraft: vi.fn().mockResolvedValue({}),
    deleteDraft: vi.fn().mockResolvedValue(undefined),
    analyze: vi.fn().mockResolvedValue({ id: "entry-1" }),
    getLatestAnalysis: vi.fn().mockResolvedValue(null),
  };
  const settings = {
    get: vi.fn().mockResolvedValue({}),
    updateProfile: vi.fn().mockResolvedValue({}),
    updatePrivacy: vi.fn().mockResolvedValue({}),
    updateNotifications: vi.fn().mockResolvedValue({}),
    createContact: vi.fn().mockResolvedValue({}),
    updateContact: vi.fn().mockResolvedValue({}),
    removeContact: vi.fn().mockResolvedValue({}),
    requestExport: vi.fn().mockResolvedValue({}),
    requestDeletion: vi.fn().mockResolvedValue({}),
    cancelDeletion: vi.fn().mockResolvedValue({}),
  };
  const experience = {
    dashboard: vi.fn().mockResolvedValue({}),
    buddySession: vi.fn().mockResolvedValue({ conversationId: "conv-1", messages: [] }),
    sendBuddyMessage: vi.fn().mockResolvedValue({ conversationId: "conv-1", messages: [] }),
    buddyHistory: vi.fn().mockResolvedValue([]),
    emotionInsights: vi.fn().mockResolvedValue({}),
    completeGrounding: vi.fn().mockResolvedValue({}),
    supportResources: vi.fn().mockResolvedValue([]),
  };
  const verification = {
    getStatus: vi.fn().mockResolvedValue({}),
    saveApplication: vi.fn().mockResolvedValue({}),
    uploadDocument: vi.fn().mockResolvedValue({}),
    submit: vi.fn().mockResolvedValue({}),
    listForAdmin: vi.fn().mockResolvedValue([]),
    getForAdmin: vi.fn().mockResolvedValue({}),
    claimForReview: vi.fn().mockResolvedValue({}),
    decide: vi.fn().mockResolvedValue({}),
    assertAiAccess: vi.fn().mockResolvedValue(undefined),
  };
  const app = createApp({
    v1: {
      journals: {
        service: journals as unknown as JournalService,
        verifier,
        verificationService: verification as unknown as VerificationService,
      },
      settings: {
        service: settings as unknown as SettingsService,
        verifier,
      },
      experience: {
        service: experience as unknown as ExperienceService,
        verifier,
        verificationService: verification as unknown as VerificationService,
      },
      verification: {
        service: verification as unknown as VerificationService,
        verifier,
      },
    },
  });
  return { app, journals, settings, experience, verification };
}

describe("mass-assignment and privilege-escalation defense (ECHO-012)", () => {
  it("strips user_id from journal create payloads instead of trusting the client", async () => {
    const { app, journals } = createHarness();

    const response = await request(app)
      .post("/api/v1/journals")
      .set("Authorization", "Bearer valid-token")
      .send({
        title: "A reflection",
        body: "Body text",
        mood: "calm",
        user_id: "victim-user",
        role: "admin",
      });

    expect(response.status).toBe(201);
    expect(journals.create).toHaveBeenCalledWith("user-1", expect.any(Object));
    const input = journals.create.mock.calls[0][1];
    expect(input).not.toHaveProperty("user_id");
    expect(input).not.toHaveProperty("role");
  });

  it("strips privileged fields from journal update payloads", async () => {
    const { app, journals } = createHarness();

    const response = await request(app)
      .patch("/api/v1/journals/123e4567-e89b-12d3-a456-426614174000")
      .set("Authorization", "Bearer valid-token")
      .send({ title: "Renamed", privacy_status: "shared", user_id: "victim-user" });

    expect(response.status).toBe(200);
    const input = journals.update.mock.calls[0][2];
    expect(input).not.toHaveProperty("user_id");
    expect(input).not.toHaveProperty("role");
    expect(input.privacyStatus).toBe("shared");
  });

  it("strips privileged fields from privacy settings updates", async () => {
    const { app, settings } = createHarness();

    const response = await request(app)
      .patch("/api/v1/settings/privacy")
      .set("Authorization", "Bearer valid-token")
      .send({
        facialAnalysisEnabled: true,
        crisisSupportVisible: true,
        lockScreenPrivate: false,
        user_id: "victim-user",
        verification_status: "approved",
      });

    expect(response.status).toBe(200);
    const input = settings.updatePrivacy.mock.calls[0][1];
    expect(input).not.toHaveProperty("user_id");
    expect(input).not.toHaveProperty("verification_status");
    expect(input).not.toHaveProperty("role");
  });

  it("rejects review decisions that smuggle status fields", async () => {
    const { app, verification } = createHarness();

    const response = await request(app)
      .post("/api/v1/admin/verifications/123e4567-e89b-12d3-a456-426614174000/decision")
      .set("Authorization", "Bearer valid-token")
      .send({ decision: "approved", status: "rejected", reviewed_by: "someone-else" });

    expect(response.status).toBe(200);
    const input = verification.decide.mock.calls[0][2];
    expect(input).not.toHaveProperty("status");
    expect(input).not.toHaveProperty("reviewed_by");
    expect(input.decision).toBe("approved");
  });

  it("derives the owner from the verified session, not from any client field", async () => {
    const { app, journals } = createHarness();

    const response = await request(app)
      .post("/api/v1/journals")
      .set("Authorization", "Bearer valid-token")
      .send({ title: "A", body: "B", mood: "calm", owner_id: "victim-user" });

    expect(response.status).toBe(201);
    expect(journals.create).toHaveBeenCalledWith("user-1", expect.any(Object));
  });
});