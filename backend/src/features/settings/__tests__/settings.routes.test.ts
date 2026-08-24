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
    updatePrivacy: vi.fn().mockResolvedValue({ privacy: { journalPrivate: true } }),
    updateNotifications: vi.fn().mockResolvedValue({ notifications: { emailEnabled: true } }),
    createContact: vi.fn().mockResolvedValue({ trustedContacts: [] }),
    updateContact: vi.fn().mockResolvedValue({ trustedContacts: [] }),
    removeContact: vi.fn().mockResolvedValue({ trustedContacts: [] }),
    requestExport: vi.fn().mockResolvedValue({ latestExport: { id: "export-1" } }),
    requestDeletion: vi.fn().mockResolvedValue({ deletionRequest: { id: "deletion-1" } }),
    cancelDeletion: vi.fn().mockResolvedValue({ deletionRequest: null }),
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
});
