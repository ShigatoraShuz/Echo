import { describe, expect, it, vi } from "vitest";
import { SettingsService } from "./settings.service.js";

function createFixture() {
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const database = {
    from: vi.fn((table: string) => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn((payload: Record<string, unknown>) => {
        updates.push({ table, payload });
        return { eq: vi.fn().mockResolvedValue({ error: null }) };
      }),
    })),
  } as any;
  const service = new SettingsService(database, { from: vi.fn() } as any);
  const snapshot = {
    profile: {
      displayName: "Mira",
      timezone: "Asia/Manila",
      themeVariant: "echo-calm",
      themeMode: "system",
      avatarPath: "https://signed.example/avatar",
    },
    privacy: {
      journalPrivate: true,
      crisisSupportVisible: true,
      lockScreenPrivate: true,
    },
    notifications: {
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      journalRemindersEnabled: true,
      wellbeingRemindersEnabled: false,
      insightNotificationsEnabled: true,
      reminderTime: "09:00",
      reminderTimezone: "Asia/Manila",
    },
    trustedContacts: [],
    latestExport: null,
    deletionRequest: null,
  };
  vi.spyOn(service, "get").mockResolvedValue(snapshot as any);
  return { service, updates };
}

describe("SettingsService PATCH semantics", () => {
  it("updates only supplied profile columns", async () => {
    const { service, updates } = createFixture();
    await service.updateProfile("user-1", { displayName: "New name" });
    expect(updates).toEqual([{ table: "profiles", payload: { display_name: "New name" } }]);
  });

  it("updates only supplied privacy columns", async () => {
    const { service, updates } = createFixture();
    await service.updatePrivacy("user-1", { crisisSupportVisible: false });
    expect(updates).toEqual([{ table: "privacy_preferences", payload: { crisis_support_visible: false } }]);
  });

  it("validates reminders against current values without writing omitted columns", async () => {
    const { service, updates } = createFixture();
    await service.updateNotifications("user-1", { emailEnabled: false });
    expect(updates).toEqual([{ table: "notification_preferences", payload: { email_enabled: false } }]);
  });

  it("rejects an avatar whose bytes do not match its declared image type", async () => {
    const { service } = createFixture();
    await expect(service.uploadAvatar("user-1", "image/png", Buffer.from("not a png")))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
