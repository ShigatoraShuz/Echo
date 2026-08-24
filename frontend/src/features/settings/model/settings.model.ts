import type { EchoThemeMode, EchoThemeVariant } from "@/shared/theme";

export interface ProfileSettings {
  displayName: string;
  timezone: string;
  themeVariant: EchoThemeVariant;
  themeMode: EchoThemeMode;
  /** Public URL or storage path for the user's avatar image */
  avatarPath?: string | null;
}

export interface PrivacySettings {
  journalPrivate: true;
  facialAnalysisEnabled: boolean;
  crisisSupportVisible: boolean;
  lockScreenPrivate: boolean;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  journalRemindersEnabled: boolean;
  wellbeingRemindersEnabled: boolean;
  insightNotificationsEnabled: boolean;
  reminderTime: string | null;
  reminderTimezone: string | null;
}

export interface TrustedContact {
  id: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  relationship: string;
  verified: boolean;
  isPrimary: boolean;
  permissionAcknowledged: boolean;
}

export type TrustedContactInput = Omit<TrustedContact, "id" | "verified">;

export interface ExportRequest {
  id: string;
  status: "requested" | "processing" | "completed" | "failed" | "cancelled";
  requestedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
}

export interface DeletionRequest {
  id: string;
  status: "pending" | "cancelled" | "processing" | "completed" | "failed";
  requestedAt: string;
  scheduledFor: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
}

export interface SecurityAuditEvent {
  id: string;
  eventType: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SettingsSnapshot {
  profile: ProfileSettings;
  privacy: PrivacySettings;
  notifications: NotificationSettings;
  trustedContacts: TrustedContact[];
  latestExport: ExportRequest | null;
  exportHistory: ExportRequest[];
  deletionRequest: DeletionRequest | null;
}

