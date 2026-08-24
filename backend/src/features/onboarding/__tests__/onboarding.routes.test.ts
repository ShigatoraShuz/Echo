import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import type { OnboardingService } from "../onboarding.service.js";

function createHarness() {
  const verifier = {
    getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "user@example.com" }),
  };
  const onboarding = {
    getStatus: vi.fn().mockResolvedValue({
      onboardingCompleted: false,
      displayName: "",
      timezone: "UTC",
      consents: {},
    }),
    saveConsent: vi.fn().mockResolvedValue({ success: true }),
    saveProfile: vi.fn().mockResolvedValue({ success: true }),
    saveSetup: vi.fn().mockResolvedValue({ success: true }),
    completeOnboarding: vi.fn().mockResolvedValue({ success: true }),
  };
  const app = createApp({
    v1: {
      onboarding: {
        service: onboarding as unknown as OnboardingService,
        verifier,
      },
    },
  });
  return { app, onboarding };
}

describe("onboarding routes", () => {
  it("returns onboarding status for the authenticated user", async () => {
    const { app, onboarding } = createHarness();

    const response = await request(app)
      .get("/api/v1/onboarding/status")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(onboarding.getStatus).toHaveBeenCalledWith("user-1");
  });

  it("saves onboarding consent payloads", async () => {
    const { app, onboarding } = createHarness();

    const response = await request(app)
      .post("/api/v1/onboarding/consent")
      .set("Authorization", "Bearer valid-token")
      .send({ terms: true, privacy: true, dataProcessing: true, aiInformation: false, journalAnalysis: true });

    expect(response.status).toBe(200);
    expect(onboarding.saveConsent).toHaveBeenCalledWith("user-1", {
      terms: true,
      privacy: true,
      dataProcessing: true,
      aiInformation: false,
      journalAnalysis: true,
    });
  });

  it("forwards onboarding profile payloads to the service", async () => {
    const { app, onboarding } = createHarness();

    const response = await request(app)
      .post("/api/v1/onboarding/profile")
      .set("Authorization", "Bearer valid-token")
      .send({ displayName: "", timezone: "" });

    expect(response.status).toBe(200);
    expect(onboarding.saveProfile).toHaveBeenCalledWith("user-1", { displayName: "", timezone: "" });
  });

  it("completes onboarding", async () => {
    const { app, onboarding } = createHarness();

    const response = await request(app)
      .post("/api/v1/onboarding/complete")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(onboarding.completeOnboarding).toHaveBeenCalledWith("user-1");
  });
});
