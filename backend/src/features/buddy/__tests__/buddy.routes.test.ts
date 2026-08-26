import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import type { BuddyService } from "../buddy.service.js";
import type { VerificationService } from "../../verification/verification.service.js";
import { VerificationRequiredError } from "../../../shared/errors/app-error.js";

function createHarness(verified = true) {
  const service = {
    buddySession: vi.fn().mockResolvedValue({ conversationId: "conversation-1", messages: [] }),
    sendBuddyMessage: vi.fn().mockResolvedValue({ conversationId: "conversation-1", messages: [] }),
    buddyHistory: vi.fn().mockResolvedValue([]),
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
      buddy: {
        service: service as unknown as BuddyService,
        verifier,
        verificationService: verificationService as unknown as VerificationService,
      },
    },
  });
  return { app, service, verificationService };
}

describe("buddy routes", () => {
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
});

