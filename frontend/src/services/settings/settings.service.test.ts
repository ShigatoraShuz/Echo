import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

const tokenProvider = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
}));

vi.mock("@/infrastructure/api/api-client", () => ({
  createApiClient: () => api,
}));

vi.mock("@/infrastructure/api/supabase-auth-token-provider", () => ({
  supabaseAuthTokenProvider: tokenProvider,
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
  exportHistory: [],
  deletionRequest: null,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
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

  it("uses explicit endpoints for export and deletion recovery", async () => {
    const exportSnapshot = {
      ...snapshot,
      latestExport: {
        id: "export-1",
        status: "requested" as const,
        requestedAt: "2026-08-25T00:00:00.000Z",
        completedAt: null,
        expiresAt: null,
      },
      exportHistory: [],
    };
    api.post
      .mockResolvedValueOnce({ success: true, data: exportSnapshot })
      .mockResolvedValueOnce({ success: true, data: snapshot });
    api.patch.mockResolvedValue({ success: true, data: snapshot });

    await expect(settingsService.requestExport()).resolves.toEqual(exportSnapshot.latestExport);
    await settingsService.requestDeletion();
    await settingsService.cancelDeletion("request/1");

    expect(api.post).toHaveBeenNthCalledWith(1, "/settings/data-exports");
    expect(api.post).toHaveBeenNthCalledWith(2, "/settings/account-deletion");
    expect(api.patch).toHaveBeenCalledWith(
      "/settings/account-deletion/request%2F1/cancel",
    );
  });

  it("sends password changes to the security password endpoint", async () => {
    const payload = {
      currentPassword: "OldPassword1!",
      newPassword: "NewPassword1!",
      confirmPassword: "NewPassword1!",
    };
    api.patch.mockResolvedValueOnce({ success: true, data: { passwordChanged: true } });

    await expect(settingsService.changePassword(payload)).resolves.toEqual({ passwordChanged: true });

    expect(api.patch).toHaveBeenCalledWith("/settings/security/password", payload);
  });

  it("uploads avatar files through the binary avatar endpoint", async () => {
    tokenProvider.getAccessToken.mockResolvedValueOnce("access-token");
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ success: true, data: snapshot }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["image"], "avatar.png", { type: "image/png" });

    await expect(settingsService.uploadAvatar(file)).resolves.toEqual(snapshot);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4200/api/v1/settings/profile/avatar",
      {
        method: "PUT",
        headers: {
          "Content-Type": "image/png",
          Authorization: "Bearer access-token",
        },
        body: file,
      },
    );
  });
});
