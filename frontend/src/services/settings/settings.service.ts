import type {
  DeletionRequest,
  ExportRequest,
  NotificationSettings,
  PrivacySettings,
  ProfileSettings,
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
  updatePrivacy(updates: Partial<PrivacySettings>): Promise<PrivacySettings>;
  updateNotifications(updates: Partial<NotificationSettings>): Promise<NotificationSettings>;
  createContact(input: TrustedContactInput): Promise<TrustedContact>;
  updateContact(id: string, input: TrustedContactInput): Promise<TrustedContact>;
  removeContact(id: string): Promise<void>;
  requestExport(): Promise<ExportRequest>;
  requestDeletion(): Promise<DeletionRequest>;
  cancelDeletion(id: string): Promise<DeletionRequest>;
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

export const settingsService: SettingsService = {
  get() {
    return unwrap(client.get<ApiEnvelope<SettingsSnapshot>>("/settings"));
  },
  updateProfile(updates) {
    return unwrap(client.patch<ApiEnvelope<ProfileSettings>, Partial<ProfileSettings>>("/settings/profile", updates));
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
  requestExport() {
    return unwrap(client.post<ApiEnvelope<ExportRequest>>("/settings/data-exports"));
  },
  requestDeletion() {
    return unwrap(client.post<ApiEnvelope<DeletionRequest>>("/settings/account-deletion"));
  },
  cancelDeletion(id) {
    return unwrap(client.patch<ApiEnvelope<DeletionRequest>>(
      `/settings/account-deletion/${encodeURIComponent(id)}/cancel`,
    ));
  },
};