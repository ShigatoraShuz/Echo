import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useSettingsViewModel } from "@/features/settings/view-model/use-settings-view-model";
import type { SettingsSnapshot } from "@/features/settings/model/settings.model";
import { settingsService } from "@/services/settings/settings.service";

vi.mock("@/services/settings/settings.service", () => ({
  settingsService: {
    get: vi.fn(),
  },
}));

describe("useSettingsViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads settings on mount", async () => {
    vi.mocked(settingsService.get).mockResolvedValue({
      profile: {
        displayName: "Mira",
        timezone: "Asia/Shanghai",
        themeVariant: "echo-calm",
        themeMode: "light",
        avatarPath: null,
      },
      privacy: {
        journalPrivate: true,
        crisisSupportVisible: true,
        lockScreenPrivate: true,
      },
      notifications: {
        emailEnabled: true,
        pushEnabled: false,
        inAppEnabled: true,
        journalRemindersEnabled: true,
        wellbeingRemindersEnabled: false,
        insightNotificationsEnabled: true,
        reminderTime: "20:00",
        reminderTimezone: "Asia/Shanghai",
      },
      trustedContacts: [],
      latestExport: null,
      deletionRequest: null,
    });

    const { result } = renderHook(() => useSettingsViewModel());

    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings?.profile.displayName).toBe("Mira");
    expect(result.current.error).toBeNull();
  });

  it("reports a normalized error when loading fails", async () => {
    vi.mocked(settingsService.get).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useSettingsViewModel());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });

  it("runs an operation and refreshes after success", async () => {
    const snapshot: SettingsSnapshot = {
      profile: {
        displayName: "Mira",
        timezone: "Asia/Shanghai",
        themeVariant: "echo-calm",
        themeMode: "light",
        avatarPath: null,
      },
      privacy: {
        journalPrivate: true,
        crisisSupportVisible: true,
        lockScreenPrivate: true,
      },
      notifications: {
        emailEnabled: true,
        pushEnabled: false,
        inAppEnabled: true,
        journalRemindersEnabled: true,
        wellbeingRemindersEnabled: false,
        insightNotificationsEnabled: true,
        reminderTime: "20:00",
        reminderTimezone: "Asia/Shanghai",
      },
      trustedContacts: [],
      latestExport: null,
      deletionRequest: null,
    };

    vi.mocked(settingsService.get).mockResolvedValue(snapshot);

    const { result } = renderHook(() => useSettingsViewModel());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const ok = await act(async () => result.current.run(async () => undefined, "Saved"));
    expect(ok).toBe(true);
    expect(result.current.notice).toBe("Saved");
  });
});
