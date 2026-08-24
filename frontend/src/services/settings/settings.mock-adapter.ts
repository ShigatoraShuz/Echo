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
import type { SettingsService } from "@/services/settings/settings.service";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const defaultProfile: ProfileSettings = {
  displayName: "You",
  timezone: "UTC",
  themeVariant: "echo-soft",
  themeMode: "system",
};

const defaultPrivacy: PrivacySettings = {
  journalPrivate: true,
  facialAnalysisEnabled: false,
  crisisSupportVisible: true,
  lockScreenPrivate: false,
};

const defaultNotifications: NotificationSettings = {
  emailEnabled: true,
  pushEnabled: true,
  inAppEnabled: true,
  journalRemindersEnabled: true,
  wellbeingRemindersEnabled: false,
  insightNotificationsEnabled: true,
  reminderTime: "09:00",
  reminderTimezone: "UTC",
};

const defaultContacts: TrustedContact[] = [
  { id: "contact-1", contactName: "Sam", contactEmail: "sam@example.com", contactPhone: "", relationship: "Partner", verified: true, isPrimary: true, permissionAcknowledged: true },
  { id: "contact-2", contactName: "Dr. Morgan", contactEmail: "", contactPhone: "+1-555-0123", relationship: "Therapist", verified: false, isPrimary: false, permissionAcknowledged: false },
];

const defaultAuditEvents: SecurityAuditEvent[] = [
  {
    id: "audit-1",
    eventType: "settings.profile_updated",
    resourceType: "profile",
    resourceId: null,
    metadata: {},
    createdAt: new Date(Date.now() - 60_000).toISOString(),
  },
  {
    id: "audit-2",
    eventType: "security.sign_out_all_devices",
    resourceType: "auth_session",
    resourceId: null,
    metadata: {},
    createdAt: new Date(Date.now() - 120_000).toISOString(),
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function createSettingsMockAdapter(): SettingsService {
  let profile = { ...defaultProfile };
  let privacy = { ...defaultPrivacy };
  let notifications = { ...defaultNotifications };
  const contacts = [...defaultContacts];
  let latestExport: ExportRequest | null = null;
  const exportHistory: ExportRequest[] = [];
  let deletionRequest: DeletionRequest | null = null;

  const snapshot = (): SettingsSnapshot => ({
    profile,
    privacy,
    notifications,
    trustedContacts: [...contacts],
    latestExport,
    exportHistory: [...exportHistory],
    deletionRequest,
  });

  return {
    async get() {
      await delay(100);
      return snapshot();
    },
    async updateProfile(updates) {
      await delay(150);
      profile = { ...profile, ...updates };
      return profile;
    },
    async uploadAvatar(file) {
      await delay(150);
      profile = {
        ...profile,
        avatarPath: `mock-avatar://${encodeURIComponent(file.name)}`,
      };
      return snapshot();
    },
    async updatePrivacy(updates) {
      await delay(150);
      privacy = { ...privacy, ...updates };
      return privacy;
    },
    async updateNotifications(updates) {
      await delay(150);
      notifications = { ...notifications, ...updates };
      return notifications;
    },
    async createContact(input: TrustedContactInput) {
      await delay(150);
      const contact: TrustedContact = { ...input, id: `contact-${Date.now().toString(36)}`, verified: false };
      contacts.push(contact);
      return contact;
    },
    async updateContact(id: string, input: TrustedContactInput) {
      await delay(150);
      const idx = contacts.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error("Contact not found");
      contacts[idx] = { ...contacts[idx], ...input };
      return contacts[idx];
    },
    async removeContact(id) {
      await delay(150);
      const idx = contacts.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error("Contact not found");
      contacts.splice(idx, 1);
    },
    async requestExport() {
      await delay(150);
      latestExport = { id: `export-${Date.now().toString(36)}`, status: "requested", requestedAt: nowIso(), completedAt: null, expiresAt: null };
      exportHistory.unshift(latestExport);
      return latestExport;
    },
    async requestDeletion() {
      await delay(150);
      deletionRequest = { id: `deletion-${Date.now().toString(36)}`, status: "pending", requestedAt: nowIso(), scheduledFor: daysFromNow(30), cancelledAt: null, completedAt: null };
      return deletionRequest;
    },
    async cancelDeletion(id) {
      await delay(150);
      if (deletionRequest?.id !== id) throw new Error("Deletion request not found");
      deletionRequest = { ...deletionRequest, status: "cancelled", cancelledAt: nowIso() };
      return deletionRequest;
    },
    async getSecurityAuditEvents(limit = 50) {
      await delay(100);
      return { auditEvents: defaultAuditEvents.slice(0, limit) };
    },
    async changePassword(input) {
      await delay(150);
      if (!input.currentPassword) throw new Error("Current password is required.");
      return { passwordChanged: true };
    },
    async signOutAllDevices() {
      await delay(150);
      return { signedOut: true };
    },
  };
}
