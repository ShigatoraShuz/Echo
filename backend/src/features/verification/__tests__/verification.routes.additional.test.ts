import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import type { VerificationService } from "../verification.service.js";

function createHarness() {
  const verifier = {
    getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "user@example.com" }),
  };
  const verification = {
    getStatus: vi.fn().mockResolvedValue({ status: "not_started" }),
    saveApplication: vi.fn().mockResolvedValue({ status: "draft" }),
    uploadDocument: vi.fn().mockResolvedValue({ status: "draft" }),
    submit: vi.fn().mockResolvedValue({ status: "submitted" }),
    listForAdmin: vi.fn().mockResolvedValue([]),
    getForAdmin: vi.fn().mockResolvedValue({ id: "verification-1" }),
    claimForReview: vi.fn().mockResolvedValue({ id: "verification-1" }),
    decide: vi.fn().mockResolvedValue({ id: "verification-1" }),
    assertAiAccess: vi.fn().mockResolvedValue(undefined),
  };
  const app = createApp({
    v1: {
      verification: {
        service: verification as unknown as VerificationService,
        verifier,
      },
    },
  });
  return { app, verification };
}

describe("verification routes", () => {
  it("returns verification status for the authenticated user", async () => {
    const { app, verification } = createHarness();

    const response = await request(app)
      .get("/api/v1/verification")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(verification.getStatus).toHaveBeenCalledWith("user-1");
  });

  it("saves a verification application", async () => {
    const { app, verification } = createHarness();

    const response = await request(app)
      .put("/api/v1/verification/application")
      .set("Authorization", "Bearer valid-token")
      .send({
        legalName: "Echo User",
        dateOfBirth: "2000-01-01",
        phoneNumber: "5551234567",
        address: {
          line1: "1 Main Street",
          line2: null,
          city: "Manila",
          province: "NCR",
          postalCode: "1000",
          countryCode: "PH",
        },
        governmentIdType: "passport",
        governmentIdNumber: "A1234567",
        guardian: null,
        privacyNoticeAccepted: true,
        identityVerificationConsent: true,
        guardianConsent: false,
      });

    expect(response.status).toBe(200);
    expect(verification.saveApplication).toHaveBeenCalledWith("user-1", expect.any(Object));
  });

  it("accepts raw document uploads only for supported content types", async () => {
    const { app, verification } = createHarness();

    const response = await request(app)
      .put("/api/v1/verification/documents/user_government_id")
      .set("Authorization", "Bearer valid-token")
      .set("Content-Type", "image/png")
      .send(Buffer.from("png-bytes"));

    expect(response.status).toBe(200);
    expect(verification.uploadDocument).toHaveBeenCalledWith(
      "user-1",
      "user_government_id",
      "image/png",
      expect.any(Buffer),
    );
  });

  it("submits a verification application", async () => {
    const { app, verification } = createHarness();

    const response = await request(app)
      .post("/api/v1/verification/submit")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(verification.submit).toHaveBeenCalledWith("user-1");
  });

  it("lists admin verifications with the query string preserved", async () => {
    const { app, verification } = createHarness();

    const response = await request(app)
      .get("/api/v1/admin/verifications?status=submitted")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(verification.listForAdmin).toHaveBeenCalledWith("user-1", "submitted");
  });
});
