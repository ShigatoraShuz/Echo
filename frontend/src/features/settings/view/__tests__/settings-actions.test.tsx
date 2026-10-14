import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationSettingsView, TrustedContactsSettingsView } from "../settings-views";
import { useSettingsViewModel } from "@/features/settings/view-model/use-settings-view-model";

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

function mockViewModel(settings = baseSettings) {
  const model = {
    settings,
    loading: false,
    saving: false,
    error: null,
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

    await user.click(screen.getByRole("switch", { name: /Daily Check-in/i }));
    expect(screen.getByRole("button", { name: /Save Reminders/i })).toBeDisabled();
    await user.type(screen.getByLabelText("Target Time"), "08:00");
    expect(screen.getByRole("button", { name: /Save Reminders/i })).toBeDisabled();
  });
});
