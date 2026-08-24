import type {
  DeletionRequest,
  ExportRequest,
  NotificationSettings,
  PrivacySettings,
  ProfileSettings,
  SecurityAuditEvent,
  SettingsSnapshot,
  TrustedContact,
  TrustedContactInput,
} from "@/features/settings/model/settings.model";
import { env } from "@/config/environment";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";

export interface SettingsService {
  get(): Promise<SettingsSnapshot>;
  updateProfile(updates: Partial<ProfileSettings>): Promise<ProfileSettings>;
  uploadAvatar(file: File): Promise<SettingsSnapshot>;
  updatePrivacy(updates: Partial<PrivacySettings>): Promise<PrivacySettings>;
  updateNotifications(updates: Partial<NotificationSettings>): Promise<NotificationSettings>;
  createContact(input: TrustedContactInput): Promise<TrustedContact>;
  updateContact(id: string, input: TrustedContactInput): Promise<TrustedContact>;
  removeContact(id: string): Promise<void>;
  requestExport(): Promise<ExportRequest>;
  requestDeletion(): Promise<DeletionRequest>;
  cancelDeletion(id: string): Promise<DeletionRequest>;
  getSecurityAuditEvents(limit?: number): Promise<{ auditEvents: SecurityAuditEvent[] }>;
  changePassword(input: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<{ passwordChanged: true }>;
  signOutAllDevices(): Promise<{ signedOut: true }>;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

const client = createApiClient({
  baseUrl: env.apiBaseUrl,
  tokenProvider: supabaseAuthTokenProvider,
});

async function unwrap<T>(promise: Promise<ApiEnvelope<T>>): Promise<T> {
  const envelope = await promise;
  if (!envelope || envelope.success === false) {
    throw new Error("Settings service returned an unsuccessful response.");
  }
  return envelope.data;
}

function endpoint(path: string): string {
  return `${env.apiBaseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export const settingsService: SettingsService = {
  get() {
    return unwrap(client.get<ApiEnvelope<SettingsSnapshot>>("/settings"));
  },
  updateProfile(updates) {
    return unwrap(client.patch<ApiEnvelope<ProfileSettings>, Partial<ProfileSettings>>("/settings/profile", updates));
  },
  async uploadAvatar(file) {
    const token = await supabaseAuthTokenProvider.getAccessToken();
    const response = await fetch(endpoint("/settings/profile/avatar"), {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: file,
    });
    const body = (await response.json()) as
      | ApiEnvelope<SettingsSnapshot>
      | { error?: { message?: string } };

    if (!response.ok || !("data" in body)) {
      throw new Error(
        "error" in body && body.error?.message
          ? body.error.message
          : "The profile photo could not be uploaded.",
      );
    }

    return body.data;
  },
  updatePrivacy(updates) {
    return unwrap(client.patch<ApiEnvelope<PrivacySettings>, Partial<PrivacySettings>>("/settings/privacy", updates));
  },
  updateNotifications(updates) {
    return unwrap(client.patch<ApiEnvelope<NotificationSettings>, Partial<NotificationSettings>>("/settings/notifications", updates));
  },
  createContact(input) {
    return unwrap(client.post<ApiEnvelope<TrustedContact>, TrustedContactInput>("/settings/trusted-contacts", input));
  },
  updateContact(id, input) {
    return unwrap(client.patch<ApiEnvelope<TrustedContact>, TrustedContactInput>(
      `/settings/trusted-contacts/${encodeURIComponent(id)}`,
      input,
    ));
  },
  async removeContact(id) {
    await client.delete(`/settings/trusted-contacts/${encodeURIComponent(id)}`);
  },
  async requestExport() {
    const snapshot = await unwrap(client.post<ApiEnvelope<SettingsSnapshot>>("/settings/data-exports"));
    if (!snapshot.latestExport) {
      throw new Error("The export request could not be loaded after it was recorded.");
    }
    return snapshot.latestExport;
  },
  requestDeletion() {
    return unwrap(client.post<ApiEnvelope<DeletionRequest>>("/settings/account-deletion"));
  },
  cancelDeletion(id) {
    return unwrap(client.patch<ApiEnvelope<DeletionRequest>>(
      `/settings/account-deletion/${encodeURIComponent(id)}/cancel`,
    ));
  },
  getSecurityAuditEvents(limit = 50) {
    return unwrap(client.get<ApiEnvelope<{ auditEvents: SecurityAuditEvent[] }>>(
      `/settings/security/audit-events?limit=${encodeURIComponent(String(limit))}`,
    ));
  },
  changePassword(input) {
    return unwrap(client.patch<ApiEnvelope<{ passwordChanged: true }>, typeof input>(
      "/settings/security/password",
      input,
    ));
  },
  signOutAllDevices() {
    return unwrap(client.post<ApiEnvelope<{ signedOut: true }>>("/settings/security/sign-out-all-devices"));
  },
};
