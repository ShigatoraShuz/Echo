import type { ProfileSettings, PrivacySettings, NotificationSettings, TrustedContact } from "../model/settings.model";

export type SettingsServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export interface SettingsService {
  getProfile(): Promise<SettingsServiceResult<ProfileSettings>>;
  updateProfile(updates: Partial<ProfileSettings>): Promise<SettingsServiceResult<ProfileSettings>>;
  getPrivacy(): Promise<SettingsServiceResult<PrivacySettings>>;
  updatePrivacy(updates: Partial<PrivacySettings>): Promise<SettingsServiceResult<PrivacySettings>>;
  getNotifications(): Promise<SettingsServiceResult<NotificationSettings>>;
  updateNotifications(updates: Partial<NotificationSettings>): Promise<SettingsServiceResult<NotificationSettings>>;
  listContacts(): Promise<SettingsServiceResult<TrustedContact[]>>;
  createContact(contact: Omit<TrustedContact, "id">): Promise<SettingsServiceResult<TrustedContact>>;
  updateContact(id: string, updates: Partial<TrustedContact>): Promise<SettingsServiceResult<TrustedContact>>;
  removeContact(id: string): Promise<SettingsServiceResult<void>>;
}
