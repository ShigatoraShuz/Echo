import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/infrastructure/api/api-client", () => ({
  createApiClient: () => api,
}));

vi.mock("@/infrastructure/api/supabase-auth-token-provider", () => ({
  supabaseAuthTokenProvider: {},
}));

import { settingsService } from "@/services/settings/settings.service";

const snapshot = {
  profile: {
    displayName: "Mira",
    timezone: "Asia/Manila",
    themeVariant: "echo-soft",
    themeMode: "light",
  },
  privacy: {
    journalPrivate: true,
    facialAnalysisEnabled: false,
    crisisSupportVisible: true,
    lockScreenPrivate: true,
  },
  notifications: {
    emailEnabled: false,
    pushEnabled: false,
    inAppEnabled: true,
    journalRemindersEnabled: false,
    wellbeingRemindersEnabled: false,
    insightNotificationsEnabled: false,
    reminderTime: null,
    reminderTimezone: null,
  },
  trustedContacts: [],
  latestExport: null,
  deletionRequest: null,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("settingsService", () => {
  it("loads and unwraps the authenticated settings snapshot", async () => {
    api.get.mockResolvedValueOnce({ success: true, data: snapshot });

    await expect(settingsService.get()).resolves.toEqual(snapshot);
    expect(api.get).toHaveBeenCalledWith("/settings");
  });

  it("encodes trusted-contact identifiers before updating", async () => {
    api.patch.mockResolvedValueOnce({ success: true, data: snapshot });
    const contact = {
      contactName: "Jordan",
      contactEmail: "jordan@example.com",
      contactPhone: null,
      relationship: "Friend",
      isPrimary: true,
      permissionAcknowledged: true as const,
    };

    await settingsService.updateContact("contact/with spaces", contact);

    expect(api.patch).toHaveBeenCalledWith(
      "/settings/trusted-contacts/contact%2Fwith%20spaces",
      contact,
    );
  });

  it("uploads avatar bytes to the dedicated binary endpoint", async () => {
    const profile = { ...snapshot.profile, avatarPath: "https://signed.example/avatar" };
    api.put.mockResolvedValueOnce({ success: true, data: profile });
    const file = new File([new Uint8Array([1, 2, 3])], "avatar.png", { type: "image/png" });
    await expect(settingsService.uploadAvatar(file)).resolves.toEqual(profile);
    expect(api.put).toHaveBeenCalledWith("/settings/avatar", file, { headers: { "Content-Type": "image/png" } });
  });

  it("uses explicit endpoints for export and deletion recovery", async () => {
    api.post.mockResolvedValue({ success: true, data: snapshot });
    api.patch.mockResolvedValue({ success: true, data: snapshot });

    await settingsService.requestExport();
    await settingsService.requestDeletion();
    await settingsService.cancelDeletion("request/1");

    expect(api.post).toHaveBeenNthCalledWith(1, "/settings/data-exports");
    expect(api.post).toHaveBeenNthCalledWith(2, "/settings/account-deletion");
    expect(api.patch).toHaveBeenCalledWith(
      "/settings/account-deletion/request%2F1/cancel",
    );
  });
});
