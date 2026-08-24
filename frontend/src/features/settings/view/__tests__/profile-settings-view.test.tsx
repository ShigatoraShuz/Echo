import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileSettingsView } from "../settings-views";
import { useSettingsViewModel } from "@/features/settings/view-model/use-settings-view-model";
import { settingsService } from "@/services/settings/settings.service";

vi.mock("@/shared/components/layout/echo-shells", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SettingsShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../components", () => ({
  SettingsHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  SettingsSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  SettingsRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarUpload: ({ displayName }: { displayName: string }) => <div>Avatar for {displayName}</div>,
}));

vi.mock("@/features/settings/view-model/use-settings-view-model", () => ({
  useSettingsViewModel: vi.fn(),
}));

vi.mock("@/services/settings/settings.service", () => ({
  settingsService: {
    updateProfile: vi.fn(),
  },
}));

function setupMock() {
  return {
    settings: {
      profile: {
        displayName: "Mira",
        timezone: "Asia/Manila",
        themeVariant: "echo-calm" as const,
        themeMode: "light" as const,
        avatarPath: null,
      },
      privacy: {
        journalPrivate: true,
        facialAnalysisEnabled: false,
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
        reminderTime: "08:00",
        reminderTimezone: "Asia/Manila",
      },
      trustedContacts: [],
      latestExport: null,
      deletionRequest: null,
    },
    loading: false,
    saving: false,
    error: null,
    notice: null,
    refresh: vi.fn(),
    run: vi.fn().mockResolvedValue(true),
  };
}

describe("ProfileSettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the profile form and saves it", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    vi.mocked(useSettingsViewModel).mockReturnValue(mock as unknown as ReturnType<typeof useSettingsViewModel>);

    render(<ProfileSettingsView />);

    const displayName = screen.getByDisplayValue("Mira");
    await user.clear(displayName);
    await user.type(displayName, "Mira Updated");
    await user.selectOptions(screen.getByRole("combobox"), "Asia/Tokyo");
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    expect(settingsService.updateProfile).toBeDefined();
    expect(mock.run).toHaveBeenCalled();
  });
});
