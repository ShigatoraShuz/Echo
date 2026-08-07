import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { VerificationService } from "../src/features/verification/verification.service.js";

function harness() {
  const snapshot = {
    status: "draft",
    canAccessAi: false,
    canReview: false,
    documents: [],
  };
  const service = {
    getStatus: vi.fn().mockResolvedValue(snapshot),
    saveApplication: vi.fn().mockResolvedValue(snapshot),
    uploadDocument: vi.fn().mockResolvedValue(snapshot),
    submit: vi.fn().mockResolvedValue({ ...snapshot, status: "submitted" }),
    listForAdmin: vi.fn().mockResolvedValue([]),
    getForAdmin: vi.fn(),
    claimForReview: vi.fn(),
    decide: vi.fn(),
  };
  const verifier = {
    getUser: vi.fn(async (token: string) =>
      token === "valid-token" ? { id: "user-1", email: "user@example.com" } : null,
    ),
  };
  return {
    service,
    app: createApp({
      v1: {
        verification: {
          service: service as unknown as VerificationService,
          verifier,
        },
      },
    }),
  };
}

describe("verification routes", () => {
  it("requires authentication before returning verification state", async () => {
    const { app, service } = harness();

    expect((await request(app).get("/api/v1/verification")).status).toBe(401);
    const authenticated = await request(app)
      .get("/api/v1/verification")
      .set("Authorization", "Bearer valid-token");
    expect(authenticated.status).toBe(200);
    expect(service.getStatus).toHaveBeenCalledWith("user-1");
  });

  it("accepts only protected supported document payloads", async () => {
    const { app, service } = harness();
    const response = await request(app)
      .put("/api/v1/verification/documents/user_government_id")
      .set("Authorization", "Bearer valid-token")
      .set("Content-Type", "image/png")
      .send(Buffer.from([137, 80, 78, 71]));

    expect(response.status).toBe(200);
    expect(service.uploadDocument).toHaveBeenCalledWith(
      "user-1",
      "user_government_id",
      "image/png",
      expect.any(Buffer),
    );

    const unsupported = await request(app)
      .put("/api/v1/verification/documents/user_government_id")
      .set("Authorization", "Bearer valid-token")
      .set("Content-Type", "text/plain")
      .send("identity");
    expect(unsupported.status).toBe(400);
  });

  it("validates the adult application contract before saving", async () => {
    const { app, service } = harness();
    const response = await request(app)
      .put("/api/v1/verification/application")
      .set("Authorization", "Bearer valid-token")
      .send({
        legalName: "ECHO QA",
        dateOfBirth: "1998-05-12",
        phoneNumber: "+639171234567",
        address: {
          line1: "1 Quiet Street",
          line2: null,
          city: "Manila",
          province: "Metro Manila",
          postalCode: "1000",
          countryCode: "PH",
        },
        governmentIdType: "Passport",
        governmentIdNumber: "QA-123456",
        guardian: null,
        privacyNoticeAccepted: true,
        identityVerificationConsent: true,
        guardianConsent: false,
      });

    expect(response.status).toBe(200);
    expect(service.saveApplication).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ legalName: "ECHO QA", guardian: null }),
    );
  });
});
