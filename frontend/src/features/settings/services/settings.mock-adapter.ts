import type { SettingsService, SettingsServiceResult } from "./settings.service";
import type { ProfileSettings, PrivacySettings, NotificationSettings, TrustedContact } from "../model/settings.model";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const defaultProfile: ProfileSettings = {
  displayName: "You",
  timezone: "UTC",
  themeVariant: "moss",
  themeMode: "system",
};

const defaultPrivacy: PrivacySettings = {
  journalPrivate: true,
  facialAnalysisEnabled: false,
  crisisSupportVisible: true,
  lockScreenPrivate: false,
};

const defaultNotifications: NotificationSettings = {
  email: true,
  push: true,
  inApp: true,
  journalReminders: true,
  wellbeingReminders: false,
  insightAlerts: true,
  reminderTime: "09:00",
  reminderTimezone: "UTC",
};

const defaultContacts: TrustedContact[] = [
  { id: "contact-1", contactName: "Sam", contactEmail: "sam@example.com", contactPhone: "", relationship: "Partner", verified: true, isPrimary: true, permissionAcknowledged: true },
  { id: "contact-2", contactName: "Dr. Morgan", contactEmail: "", contactPhone: "+1-555-0123", relationship: "Therapist", verified: false, isPrimary: false, permissionAcknowledged: false },
];

export function createSettingsMockAdapter(): SettingsService {
  let profile = { ...defaultProfile };
  let privacy = { ...defaultPrivacy };
  let notifications = { ...defaultNotifications };
  const contacts = [...defaultContacts];

  return {
    async getProfile() { await delay(100); return { success: true, data: profile }; },
    async updateProfile(updates) { await delay(150); profile = { ...profile, ...updates }; return { success: true, data: profile }; },
    async getPrivacy() { await delay(100); return { success: true, data: privacy }; },
    async updatePrivacy(updates) { await delay(150); privacy = { ...privacy, ...updates }; return { success: true, data: privacy }; },
    async getNotifications() { await delay(100); return { success: true, data: notifications }; },
    async updateNotifications(updates) { await delay(150); notifications = { ...notifications, ...updates }; return { success: true, data: notifications }; },
    async listContacts() { await delay(100); return { success: true, data: contacts }; },
    async createContact(input) { await delay(150); const contact = { ...input, id: contact- }; contacts.push(contact); return { success: true, data: contact }; },
    async updateContact(id, updates) { await delay(150); const idx = contacts.findIndex((c) => c.id === id); if (idx === -1) return { success: false, error: { code: "NOT_FOUND", message: "Contact not found" } }; contacts[idx] = { ...contacts[idx], ...updates }; return { success: true, data: contacts[idx] }; },
    async removeContact(id) { await delay(150); const idx = contacts.findIndex((c) => c.id === id); if (idx === -1) return { success: false, error: { code: "NOT_FOUND", message: "Contact not found" } }; contacts.splice(idx, 1); return { success: true, data: undefined as unknown as void }; },
  };
}
