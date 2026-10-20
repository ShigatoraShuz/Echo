import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SettingsService } from "../settings.service.js";

describe("notification settings persistence", () => {
  it("keeps in-app delivery enabled when a reminder is selected", async () => {
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    const table = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update,
      insert: vi.fn().mockResolvedValue({ error: null }),
    };
    const database = { schema: vi.fn(() => ({ from: vi.fn(() => table) })) } as unknown as SupabaseClient;
    const service = new SettingsService(database);
    vi.spyOn(service, "get").mockResolvedValue({} as Awaited<ReturnType<SettingsService["get"]>>);

    await service.updateNotifications("user-1", {
      emailEnabled: false,
      pushEnabled: false,
      inAppEnabled: false,
      journalRemindersEnabled: true,
      wellbeingRemindersEnabled: false,
      insightNotificationsEnabled: false,
      reminderTime: "08:00",
      reminderTimezone: "Asia/Manila",
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      in_app_enabled: true,
      journal_reminders_enabled: true,
    }));
    expect(update.mock.calls[0][0]).not.toHaveProperty("quiet_hours_start");
  });

  it("saves an opted-in quiet window with the reminder preference", async () => {
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    const table = { upsert: vi.fn().mockResolvedValue({ error: null }), update,
      insert: vi.fn().mockResolvedValue({ error: null }) };
    const database = { schema: vi.fn(() => ({ from: vi.fn(() => table) })) } as unknown as SupabaseClient;
    const service = new SettingsService(database);
    vi.spyOn(service, "get").mockResolvedValue({} as Awaited<ReturnType<SettingsService["get"]>>);
    await service.updateNotifications("user-1", {
      emailEnabled: false, pushEnabled: false, inAppEnabled: true,
      journalRemindersEnabled: true, wellbeingRemindersEnabled: false,
      insightNotificationsEnabled: false, reminderTime: "08:00", reminderTimezone: "Asia/Manila",
      quietHoursStart: "22:00", quietHoursEnd: "07:00",
    });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      quiet_hours_start: "22:00", quiet_hours_end: "07:00",
    }));
  });
});
