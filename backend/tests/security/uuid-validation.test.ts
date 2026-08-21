import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import type { JournalService } from "../../src/features/journals/journals.service.js";
import type { SettingsService } from "../../src/features/settings/settings.service.js";
import type { VerificationService } from "../../src/features/verification/verification.service.js";

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
// Note: an empty segment never reaches the controller (Express returns 404), so it is excluded here.
const MALFORMED_IDS = ["not-a-uuid", "42", "123e4567-e89b-12d3-a456", "123e4567e89b12d3a456426614174000"];

function createHarness() {
  const verifier = {
    getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "user@example.com" }),
  };
  const journals = {
    list: vi.fn().mockResolvedValue({ entries: [] }),
    get: vi.fn().mockResolvedValue({ id: VALID_UUID }),
    create: vi.fn().mockResolvedValue({ id: VALID_UUID }),
    update: vi.fn().mockResolvedValue({ id: VALID_UUID }),
    remove: vi.fn().mockResolvedValue(undefined),
    saveDraft: vi.fn().mockResolvedValue({}),
    getDraft: vi.fn().mockResolvedValue({}),
    deleteDraft: vi.fn().mockResolvedValue(undefined),
    analyze: vi.fn().mockResolvedValue({ id: VALID_UUID }),
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
      verification: {
        service: verification as unknown as VerificationService,
        verifier,
      },
    },
  });
  return { app, journals, settings, verification };
}

describe("path parameter UUID validation (ECHO-H05)", () => {
  for (const malformed of MALFORMED_IDS) {
    it(`rejects malformed journal id "${malformed}" with 400 before touching the service`, async () => {
      const { app, journals } = createHarness();

      const response = await request(app)
        .get(`/api/v1/journals/${malformed}`)
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(journals.get).not.toHaveBeenCalled();
    });
  }

  it("rejects malformed ids on PATCH and DELETE journal routes", async () => {
    const { app, journals } = createHarness();

    const patch = await request(app)
      .patch("/api/v1/journals/not-a-uuid")
      .set("Authorization", "Bearer valid-token")
      .send({ title: "Renamed" });
    const del = await request(app)
      .delete("/api/v1/journals/not-a-uuid")
      .set("Authorization", "Bearer valid-token");

    expect(patch.status).toBe(400);
    expect(patch.body.error.code).toBe("VALIDATION_ERROR");
    expect(del.status).toBe(400);
    expect(del.body.error.code).toBe("VALIDATION_ERROR");
    expect(journals.update).not.toHaveBeenCalled();
    expect(journals.remove).not.toHaveBeenCalled();
  });

  it("passes a well-formed UUID through to the journal service", async () => {
    const { app, journals } = createHarness();

    const response = await request(app)
      .get(`/api/v1/journals/${VALID_UUID}`)
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(journals.get).toHaveBeenCalledWith("user-1", VALID_UUID);
  });

  it("rejects malformed contact ids on trusted-contact routes", async () => {
    const { app, settings } = createHarness();

    const patch = await request(app)
      .patch("/api/v1/settings/trusted-contacts/not-a-uuid")
      .set("Authorization", "Bearer valid-token")
      .send({ contactName: "A", contactEmail: null, contactPhone: "12345", relationship: "friend", isPrimary: false, permissionAcknowledged: true });
    const del = await request(app)
      .delete("/api/v1/settings/trusted-contacts/42")
      .set("Authorization", "Bearer valid-token");

    expect(patch.status).toBe(400);
    expect(patch.body.error.code).toBe("VALIDATION_ERROR");
    expect(del.status).toBe(400);
    expect(del.body.error.code).toBe("VALIDATION_ERROR");
    expect(settings.updateContact).not.toHaveBeenCalled();
    expect(settings.removeContact).not.toHaveBeenCalled();
  });

  it("rejects a malformed request id on the account-deletion cancel route", async () => {
    const { app, settings } = createHarness();

    const response = await request(app)
      .patch("/api/v1/settings/account-deletion/not-a-uuid/cancel")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(settings.cancelDeletion).not.toHaveBeenCalled();
  });

  it("rejects malformed verification ids on every admin route", async () => {
    const { app, verification } = createHarness();

    const detail = await request(app)
      .get("/api/v1/admin/verifications/not-a-uuid")
      .set("Authorization", "Bearer valid-token");
    const claim = await request(app)
      .post("/api/v1/admin/verifications/not-a-uuid/claim")
      .set("Authorization", "Bearer valid-token");
    const decision = await request(app)
      .post("/api/v1/admin/verifications/not-a-uuid/decision")
      .set("Authorization", "Bearer valid-token")
      .send({ not: "even a review" });

    expect(detail.status).toBe(400);
    expect(detail.body.error.code).toBe("VALIDATION_ERROR");
    expect(claim.status).toBe(400);
    expect(claim.body.error.code).toBe("VALIDATION_ERROR");
    expect(decision.status).toBe(400);
    expect(decision.body.error.code).toBe("VALIDATION_ERROR");
    expect(verification.getForAdmin).not.toHaveBeenCalled();
    expect(verification.claimForReview).not.toHaveBeenCalled();
    expect(verification.decide).not.toHaveBeenCalled();
  });
});
