import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationSettingsView, PrivacySettingsView, TrustedContactsSettingsView } from "../settings-views";
import { useSettingsViewModel } from "@/features/settings/view-model/use-settings-view-model";
import { settingsService } from "@/services/settings/settings.service";
import { env } from "@/config/environment";

vi.mock("@/features/settings/view-model/use-settings-view-model", () => ({
  useSettingsViewModel: vi.fn(),
}));

const baseSettings = {
  notifications: {
    emailEnabled: false,
    pushEnabled: false,
    inAppEnabled: false,
    journalRemindersEnabled: false,
    wellbeingRemindersEnabled: false,
    insightNotificationsEnabled: false,
    reminderTime: null,
    reminderTimezone: null,
  },
  trustedContacts: [],
};

function mockViewModel(settings: unknown = baseSettings, error: string | null = null) {
  const model = {
    settings,
    loading: false,
    saving: false,
    error,
    notice: null,
    refresh: vi.fn(),
    run: vi.fn().mockResolvedValue(false),
  };
  vi.mocked(useSettingsViewModel).mockReturnValue(model as unknown as ReturnType<typeof useSettingsViewModel>);
  return model;
}

describe("settings actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the trusted contact form after a failed save", async () => {
    const user = userEvent.setup();
    const model = mockViewModel();
    render(<TrustedContactsSettingsView />);

    await user.click(screen.getByRole("button", { name: "Add Trusted Contact" }));
    await user.type(screen.getByPlaceholderText("e.g. Dr. Sarah Smith"), "QA Contact");
    await user.type(screen.getByPlaceholderText("e.g. Therapist, Partner"), "Friend");
    await user.type(screen.getByPlaceholderText("contact@example.com"), "qa@example.invalid");
    await user.click(screen.getByRole("checkbox", { name: /I have informed this person/i }));
    await user.click(screen.getByRole("button", { name: "Add Contact" }));

    expect(model.run).toHaveBeenCalledOnce();
    expect(screen.getByDisplayValue("QA Contact")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Contact" })).toBeInTheDocument();
    expect(model.refresh).not.toHaveBeenCalled();
  });

  it("requires a timezone as well as a time when reminders are enabled", async () => {
    const user = userEvent.setup();
    mockViewModel();
    render(<NotificationSettingsView />);

    expect(screen.getByLabelText("Target Time")).toBeDisabled();
    expect(screen.getByLabelText("Target Timezone")).toBeDisabled();
    await user.click(screen.getByRole("switch", { name: /Daily Check-in/i }));
    expect(screen.getByLabelText("Target Timezone")).toHaveValue("");
    expect(screen.getByRole("button", { name: /Save preferences/i })).toBeDisabled();
    await user.type(screen.getByLabelText("Target Time"), "08:00");
    expect(screen.getByRole("button", { name: /Save preferences/i })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Target Timezone"), "Asia/Manila");
    expect(screen.getByRole("button", { name: /Save preferences/i })).toBeEnabled();
  });

  it("keeps a saved timezone outside the quick-pick list", () => {
    mockViewModel({
      ...baseSettings,
      notifications: { ...baseSettings.notifications, reminderTimezone: "Europe/Paris" },
    });
    render(<NotificationSettingsView />);
    expect(screen.getByLabelText("Target Timezone")).toHaveValue("Europe/Paris");
  });

  it("validates quiet hours before allowing a reminder save", async () => {
    const user = userEvent.setup();
    mockViewModel({ ...baseSettings, notifications: {
      ...baseSettings.notifications, quietHoursAvailable: true,
      quietHoursStart: null, quietHoursEnd: null,
    } });
    render(<NotificationSettingsView />);
    await user.click(screen.getByRole("switch", { name: /Daily Check-in/i }));
    await user.type(screen.getByLabelText("Target Time"), "22:30");
    await user.selectOptions(screen.getByLabelText("Target Timezone"), "Asia/Manila");
    await user.type(screen.getByLabelText("Quiet hours start"), "22:00");
    expect(screen.getByRole("button", { name: /Save preferences/i })).toBeDisabled();
    await user.type(screen.getByLabelText("Quiet hours end"), "07:00");
    expect(screen.getByRole("alert")).toHaveTextContent("outside quiet hours");
    await user.clear(screen.getByLabelText("Target Time"));
    await user.type(screen.getByLabelText("Target Time"), "21:00");
    expect(screen.getByRole("button", { name: /Save preferences/i })).toBeEnabled();
  });

  it("enables in-app delivery when a daily reminder is selected", async () => {
    const user = userEvent.setup();
    const model = mockViewModel();
    const update = vi.spyOn(settingsService, "updateNotifications").mockResolvedValue({} as never);
    model.run.mockImplementation(async (action) => { await action(); return true; });
    render(<NotificationSettingsView />);
    await user.click(screen.getByRole("switch", { name: /Daily Check-in/i }));
    await user.type(screen.getByLabelText("Target Time"), "08:00");
    await user.selectOptions(screen.getByLabelText("Target Timezone"), "Asia/Manila");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      inAppEnabled: true,
      journalRemindersEnabled: true,
      insightNotificationsEnabled: false,
    }));
    update.mockRestore();
  });

  it("retries a failed notification save without discarding the edited choice", async () => {
    const user = userEvent.setup();
    const model = mockViewModel(baseSettings, "Save failed");
    render(<NotificationSettingsView />);

    await user.click(screen.getByRole("switch", { name: "Email Alerts" }));
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByRole("switch", { name: "Email Alerts" })).toHaveAttribute("aria-checked", "true");
    expect(model.run).toHaveBeenCalledOnce();
    expect(model.refresh).not.toHaveBeenCalled();
  });

  it("states that saved notification choices do not yet enable delivery", () => {
    mockViewModel();
    render(<NotificationSettingsView />);

    expect(screen.getByRole("note")).toHaveTextContent("not being delivered yet");
    expect(screen.getByRole("switch", { name: "Push Notifications" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save preferences" })).toBeInTheDocument();
  });

  it("describes the active in-app reminder channel separately from future push and email", () => {
    env.enableInAppReminders = true;
    try {
      mockViewModel();
      render(<NotificationSettingsView />);
      expect(screen.getByRole("note")).toHaveTextContent("daily reminder updates can appear in the app");
      expect(screen.getByRole("note")).toHaveTextContent("Push notifications are not being delivered yet");
      expect(screen.getByRole("note")).toHaveTextContent("Email alerts are not being delivered yet");
    } finally {
      env.enableInAppReminders = false;
    }
  });

  it("lets a user enable the working in-app analysis-ready notification", async () => {
    const user = userEvent.setup();
    const model = mockViewModel();
    const update = vi.spyOn(settingsService, "updateNotifications").mockResolvedValue({} as never);
    model.run.mockImplementation(async (action) => { await action(); return false; });
    render(<NotificationSettingsView />);

    await user.click(screen.getByRole("switch", { name: "Analysis-ready updates in app" }));
    await user.click(screen.getByRole("button", { name: "Save preferences" }));

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      inAppEnabled: true,
      insightNotificationsEnabled: true,
      pushEnabled: false,
    }));
    update.mockRestore();
  });

  it("retries a failed privacy save without discarding the edited choice", async () => {
    const user = userEvent.setup();
    const model = mockViewModel(
      {
        ...baseSettings,
        privacy: {
          journalPrivate: true,
          journalAiAnalysisEnabled: false,
          buddyHistoryEnabled: true,
          buddyHistoryAvailable: true,
          facialAnalysisEnabled: false,
          crisisSupportVisible: true,
          lockScreenPrivate: true,
        },
      },
      "Save failed",
    );
    render(<PrivacySettingsView />);

    await user.click(screen.getByRole("switch", { name: "Save Buddy history" }));
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByRole("switch", { name: "Save Buddy history" })).toHaveAttribute("aria-checked", "false");
    expect(model.run).toHaveBeenCalledOnce();
    expect(model.refresh).not.toHaveBeenCalled();
  });
});
