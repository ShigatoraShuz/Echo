import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import type { SettingsService } from "../settings.service.js";

function createHarness() {
  const verifier = {
    getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "user@example.com" }),
  };
  const settings = {
    get: vi.fn().mockResolvedValue({ profile: { displayName: "Echo" } }),
    updateProfile: vi.fn().mockResolvedValue({ profile: { displayName: "Echo" } }),
    uploadAvatar: vi.fn().mockResolvedValue({ profile: { avatarPath: "https://cdn.example/avatar.png" } }),
    updatePrivacy: vi.fn().mockResolvedValue({ privacy: { journalPrivate: true } }),
    updateNotifications: vi.fn().mockResolvedValue({ notifications: { emailEnabled: true } }),
    createContact: vi.fn().mockResolvedValue({ trustedContacts: [] }),
    updateContact: vi.fn().mockResolvedValue({ trustedContacts: [] }),
    removeContact: vi.fn().mockResolvedValue({ trustedContacts: [] }),
    requestExport: vi.fn().mockResolvedValue({ latestExport: { id: "export-1" } }),
    requestDeletion: vi.fn().mockResolvedValue({ deletionRequest: { id: "deletion-1" } }),
    cancelDeletion: vi.fn().mockResolvedValue({ deletionRequest: null }),
    changePassword: vi.fn().mockResolvedValue({ passwordChanged: true }),
    listSecurityAuditEvents: vi.fn().mockResolvedValue({ auditEvents: [] }),
    signOutAllDevices: vi.fn().mockResolvedValue({ signedOut: true }),
  };
  const app = createApp({
    v1: {
      settings: {
        service: settings as unknown as SettingsService,
        verifier,
      },
    },
  });
  return { app, settings };
}

describe("settings routes", () => {
  it("returns the current settings snapshot", async () => {
    const { app, settings } = createHarness();

    const response = await request(app)
      .get("/api/v1/settings")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(settings.get).toHaveBeenCalledWith("user-1");
  });

  it("updates the profile with validated fields", async () => {
    const { app, settings } = createHarness();

    const response = await request(app)
      .patch("/api/v1/settings/profile")
      .set("Authorization", "Bearer valid-token")
      .send({
        displayName: "Echo User",
        timezone: "Asia/Manila",
        themeVariant: "echo-calm",
        themeMode: "system",
      });

    expect(response.status).toBe(200);
    expect(settings.updateProfile).toHaveBeenCalledWith("user-1", {
      displayName: "Echo User",
      timezone: "Asia/Manila",
      themeVariant: "echo-calm",
      themeMode: "system",
    });
  });

  it("uploads profile avatars as authenticated binary image data", async () => {
    const { app, settings } = createHarness();
    const image = Buffer.from("fake png bytes");

    const response = await request(app)
      .put("/api/v1/settings/profile/avatar")
      .set("Authorization", "Bearer valid-token")
      .set("Content-Type", "image/png")
      .send(image);

    expect(response.status).toBe(200);
    expect(settings.uploadAvatar).toHaveBeenCalledWith("user-1", {
      contents: expect.any(Buffer),
      mimeType: "image/png",
      sizeBytes: image.length,
    });
  });

  it("rejects unsupported profile avatar file types", async () => {
    const { app, settings } = createHarness();

    const response = await request(app)
      .put("/api/v1/settings/profile/avatar")
      .set("Authorization", "Bearer valid-token")
      .set("Content-Type", "text/plain")
      .send("not an image");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(settings.uploadAvatar).not.toHaveBeenCalled();
  });

  it("rejects profile avatars larger than five megabytes", async () => {
    const { app, settings } = createHarness();
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);

    const response = await request(app)
      .put("/api/v1/settings/profile/avatar")
      .set("Authorization", "Bearer valid-token")
      .set("Content-Type", "image/jpeg")
      .send(oversized);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(settings.uploadAvatar).not.toHaveBeenCalled();
  });

  it("rejects malformed notification settings and does not call the service", async () => {
    const { app, settings } = createHarness();

    const response = await request(app)
      .patch("/api/v1/settings/notifications")
      .set("Authorization", "Bearer valid-token")
      .send({
        emailEnabled: true,
        pushEnabled: true,
        inAppEnabled: true,
        journalRemindersEnabled: true,
        wellbeingRemindersEnabled: false,
        insightNotificationsEnabled: true,
        reminderTime: null,
        reminderTimezone: null,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(settings.updateNotifications).not.toHaveBeenCalled();
  });

  it("creates trusted contacts and returns 201", async () => {
    const { app, settings } = createHarness();

    const response = await request(app)
      .post("/api/v1/settings/trusted-contacts")
      .set("Authorization", "Bearer valid-token")
      .send({
        contactName: "Trusted Person",
        contactEmail: "trusted@example.com",
        contactPhone: null,
        relationship: "friend",
        isPrimary: true,
        permissionAcknowledged: true,
      });

    expect(response.status).toBe(201);
    expect(settings.createContact).toHaveBeenCalledWith("user-1", {
      contactName: "Trusted Person",
      contactEmail: "trusted@example.com",
      contactPhone: null,
      relationship: "friend",
      isPrimary: true,
      permissionAcknowledged: true,
    });
  });

  it("rejects malformed request ids for deletion cancellation", async () => {
    const { app, settings } = createHarness();

    const response = await request(app)
      .patch("/api/v1/settings/account-deletion/not-a-uuid/cancel")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(settings.cancelDeletion).not.toHaveBeenCalled();
  });

  it("returns security audit events with a validated limit", async () => {
    const { app, settings } = createHarness();

    const response = await request(app)
      .get("/api/v1/settings/security/audit-events?limit=10")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(settings.listSecurityAuditEvents).toHaveBeenCalledWith("user-1", 10);
  });

  it("changes password through the authenticated backend route", async () => {
    const { app, settings } = createHarness();

    const response = await request(app)
      .patch("/api/v1/settings/security/password")
      .set("Authorization", "Bearer valid-token")
      .send({
        currentPassword: "OldPassword1!",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      });

    expect(response.status).toBe(200);
    expect(settings.changePassword).toHaveBeenCalledWith("user-1", "user@example.com", {
      currentPassword: "OldPassword1!",
      newPassword: "NewPassword1!",
    });
  });

  it("rejects mismatched password changes", async () => {
    const { app, settings } = createHarness();

    const response = await request(app)
      .patch("/api/v1/settings/security/password")
      .set("Authorization", "Bearer valid-token")
      .send({
        currentPassword: "OldPassword1!",
        newPassword: "NewPassword1!",
        confirmPassword: "Different1!",
      });

    expect(response.status).toBe(400);
    expect(settings.changePassword).not.toHaveBeenCalled();
  });

  it("signs out all devices with the current access token", async () => {
    const { app, settings } = createHarness();

    const response = await request(app)
      .post("/api/v1/settings/security/sign-out-all-devices")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(settings.signOutAllDevices).toHaveBeenCalledWith("user-1", "valid-token");
  });
});
