import type { OwnedDatabase } from "@echo/service-core";
import { ExternalServiceError, NotFoundError } from "../../shared/errors/app-error.js";

export type ThemeVariant = "echo-calm" | "echo-night" | "echo-soft" | "echo-focus";
export type ThemeMode = "light" | "dark" | "system";

export interface ProfileSettingsInput {
  displayName: string;
  timezone: string;
  themeVariant: ThemeVariant;
  themeMode: ThemeMode;
  /** Optional public URL or storage path for the user's avatar image */
  avatarPath?: string | null;
}

export interface PrivacySettingsInput {
  facialAnalysisEnabled: boolean;
  crisisSupportVisible: boolean;
  lockScreenPrivate: boolean;
}

export interface NotificationSettingsInput {
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  journalRemindersEnabled: boolean;
  wellbeingRemindersEnabled: boolean;
  insightNotificationsEnabled: boolean;
  reminderTime: string | null;
  reminderTimezone: string | null;
}

export interface TrustedContactInput {
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  relationship: string;
  isPrimary: boolean;
  permissionAcknowledged: boolean;
}

type Row = Record<string, unknown>;

function databaseError(message: string): ExternalServiceError {
  return new ExternalServiceError("DATABASE_UNAVAILABLE", message);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export class SettingsService {
  constructor(private readonly database: OwnedDatabase) {}

  private async ensureDefaults(userId: string): Promise<void> {
    const [profile, notifications, privacy] = await Promise.all([
      this.database.from("profiles")
        .upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true }),
      this.database.from("notification_preferences").upsert(
        { user_id: userId },
        { onConflict: "user_id", ignoreDuplicates: true },
      ),
      this.database.from("privacy_preferences").upsert(
        { user_id: userId },
        { onConflict: "user_id", ignoreDuplicates: true },
      ),
    ]);
    if (profile.error || notifications.error || privacy.error) {
      throw databaseError("Your settings could not be prepared.");
    }
  }

  async get(userId: string) {
    await this.ensureDefaults(userId);
    const [profileResult, notificationResult, privacyResult, contactsResult, exportResult, deletionResult] =
      await Promise.all([
        this.database
          .from("profiles")
          .select("display_name, timezone, theme_variant, theme_mode, avatar_path")
          .eq("id", userId)
          .single(),
        this.database
          .from("notification_preferences")
          .select(
            "email_enabled, push_enabled, in_app_enabled, journal_reminders_enabled, wellbeing_reminders_enabled, insight_notifications_enabled, reminder_time, reminder_timezone",
          )
          .eq("user_id", userId)
          .single(),
        this.database
          .from("privacy_preferences")
          .select("facial_analysis_enabled, crisis_support_visible, lock_screen_private")
          .eq("user_id", userId)
          .single(),
        this.database
          .from("trusted_contacts")
          .select(
            "id, contact_name, contact_email, contact_phone, relationship, verified, is_primary, permission_acknowledged_at, created_at, updated_at",
          )
          .eq("user_id", userId)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: true }),
        this.database
          .from("data_export_requests")
          .select("id, request_status, requested_at, completed_at, expires_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        this.database
          .from("account_deletion_requests")
          .select("id, request_status, requested_at, scheduled_for, cancelled_at, completed_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (
      profileResult.error ||
      notificationResult.error ||
      privacyResult.error ||
      contactsResult.error ||
      exportResult.error ||
      deletionResult.error
    ) {
      throw databaseError("Your settings could not be loaded.");
    }

    const profile = profileResult.data as Row;
    const notifications = notificationResult.data as Row;
    const privacy = privacyResult.data as Row;

    return {
      profile: {
        displayName: stringValue(profile.display_name),
        timezone: stringValue(profile.timezone, "Asia/Manila"),
        themeVariant: stringValue(profile.theme_variant, "echo-calm"),
        themeMode: stringValue(profile.theme_mode, "system"),
        avatarPath: nullableString(profile.avatar_path),
      },
      privacy: {
        journalPrivate: true,
        facialAnalysisEnabled: booleanValue(privacy.facial_analysis_enabled),
        crisisSupportVisible: booleanValue(privacy.crisis_support_visible, true),
        lockScreenPrivate: booleanValue(privacy.lock_screen_private, true),
      },
      notifications: {
        emailEnabled: booleanValue(notifications.email_enabled),
        pushEnabled: booleanValue(notifications.push_enabled),
        inAppEnabled: booleanValue(notifications.in_app_enabled, true),
        journalRemindersEnabled: booleanValue(notifications.journal_reminders_enabled),
        wellbeingRemindersEnabled: booleanValue(notifications.wellbeing_reminders_enabled),
        insightNotificationsEnabled: booleanValue(notifications.insight_notifications_enabled),
        reminderTime: nullableString(notifications.reminder_time)?.slice(0, 5) ?? null,
        reminderTimezone: nullableString(notifications.reminder_timezone),
      },
      trustedContacts: ((contactsResult.data ?? []) as Row[]).map((contact) => ({
        id: stringValue(contact.id),
        contactName: stringValue(contact.contact_name),
        contactEmail: nullableString(contact.contact_email),
        contactPhone: nullableString(contact.contact_phone),
        relationship: stringValue(contact.relationship),
        verified: booleanValue(contact.verified),
        isPrimary: booleanValue(contact.is_primary),
        permissionAcknowledged: contact.permission_acknowledged_at != null,
      })),
      latestExport: exportResult.data
        ? {
            id: stringValue((exportResult.data as Row).id),
            status: stringValue((exportResult.data as Row).request_status),
            requestedAt: stringValue((exportResult.data as Row).requested_at),
            completedAt: nullableString((exportResult.data as Row).completed_at),
            expiresAt: nullableString((exportResult.data as Row).expires_at),
          }
        : null,
      deletionRequest: deletionResult.data
        ? {
            id: stringValue((deletionResult.data as Row).id),
            status: stringValue((deletionResult.data as Row).request_status),
            requestedAt: stringValue((deletionResult.data as Row).requested_at),
            scheduledFor: nullableString((deletionResult.data as Row).scheduled_for),
            cancelledAt: nullableString((deletionResult.data as Row).cancelled_at),
            completedAt: nullableString((deletionResult.data as Row).completed_at),
          }
        : null,
    };
  }

  async updateProfile(userId: string, input: ProfileSettingsInput) {
    await this.ensureDefaults(userId);
    const updatePayload: Record<string, unknown> = {
      display_name: input.displayName,
      timezone: input.timezone,
      theme_variant: input.themeVariant,
      theme_mode: input.themeMode,
    };
    if (input.avatarPath !== undefined) {
      updatePayload.avatar_path = input.avatarPath;
    }
    const { error } = await this.database
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId);
    if (error) throw databaseError("Your profile settings could not be saved.");
    return (await this.get(userId)).profile;
  }

  async updatePrivacy(userId: string, input: PrivacySettingsInput) {
    await this.ensureDefaults(userId);
    const { error } = await this.database
      .from("privacy_preferences")
      .update({
        facial_analysis_enabled: input.facialAnalysisEnabled,
        crisis_support_visible: input.crisisSupportVisible,
        lock_screen_private: input.lockScreenPrivate,
      })
      .eq("user_id", userId);
    if (error) throw databaseError("Your privacy settings could not be saved.");
    return (await this.get(userId)).privacy;
  }

  async updateNotifications(userId: string, input: NotificationSettingsInput) {
    await this.ensureDefaults(userId);
    const { error } = await this.database
      .from("notification_preferences")
      .update({
        email_enabled: input.emailEnabled,
        push_enabled: input.pushEnabled,
        in_app_enabled: input.inAppEnabled,
        journal_reminders_enabled: input.journalRemindersEnabled,
        wellbeing_reminders_enabled: input.wellbeingRemindersEnabled,
        insight_notifications_enabled: input.insightNotificationsEnabled,
        reminder_time: input.reminderTime,
        reminder_timezone: input.reminderTimezone,
      })
      .eq("user_id", userId);
    if (error) throw databaseError("Your notification settings could not be saved.");
    return (await this.get(userId)).notifications;
  }

  async createContact(userId: string, input: TrustedContactInput) {
    if (input.isPrimary) {
      const { error } = await this.database
        .from("trusted_contacts")
        .update({ is_primary: false })
        .eq("user_id", userId);
      if (error) throw databaseError("Your trusted contacts could not be updated.");
    }
    const { data, error } = await this.database.from("trusted_contacts").insert({
      user_id: userId,
      contact_name: input.contactName,
      contact_email: input.contactEmail,
      contact_phone: input.contactPhone,
      relationship: input.relationship,
      is_primary: input.isPrimary,
      permission_acknowledged_at: input.permissionAcknowledged ? new Date().toISOString() : null,
    }).select("id").single();
    if (error || !data) throw databaseError("The trusted contact could not be added.");
    const contact = (await this.get(userId)).trustedContacts.find((item) => item.id === data.id);
    if (!contact) throw databaseError("The trusted contact could not be loaded after it was added.");
    return contact;
  }

  async updateContact(userId: string, contactId: string, input: TrustedContactInput) {
    if (input.isPrimary) {
      const { error } = await this.database
        .from("trusted_contacts")
        .update({ is_primary: false })
        .eq("user_id", userId)
        .neq("id", contactId);
      if (error) throw databaseError("Your trusted contacts could not be updated.");
    }
    const { data, error } = await this.database
      .from("trusted_contacts")
      .update({
        contact_name: input.contactName,
        contact_email: input.contactEmail,
        contact_phone: input.contactPhone,
        relationship: input.relationship,
        is_primary: input.isPrimary,
        permission_acknowledged_at: input.permissionAcknowledged ? new Date().toISOString() : null,
      })
      .eq("id", contactId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    if (error) throw databaseError("The trusted contact could not be updated.");
    if (!data) throw new NotFoundError("The trusted contact was not found.");
    const contact = (await this.get(userId)).trustedContacts.find((item) => item.id === contactId);
    if (!contact) throw databaseError("The trusted contact could not be loaded after it was updated.");
    return contact;
  }

  async removeContact(userId: string, contactId: string) {
    const { data, error } = await this.database
      .from("trusted_contacts")
      .delete()
      .eq("id", contactId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    if (error) throw databaseError("The trusted contact could not be removed.");
    if (!data) throw new NotFoundError("The trusted contact was not found.");
    return undefined;
  }

  async requestExport(userId: string) {
    const { data: active, error: activeError } = await this.database
      .from("data_export_requests")
      .select("id")
      .eq("user_id", userId)
      .in("request_status", ["requested", "processing"])
      .limit(1)
      .maybeSingle();
    if (activeError) throw databaseError("Your export status could not be checked.");
    if (!active) {
      const { error } = await this.database
        .from("data_export_requests")
        .insert({ user_id: userId, request_status: "requested" });
      if (error) throw databaseError("Your export request could not be created.");
    }
    const exportRequest = (await this.get(userId)).latestExport;
    if (!exportRequest) throw databaseError("Your export request could not be loaded.");
    return exportRequest;
  }

  async requestDeletion(userId: string) {
    const { data: active, error: activeError } = await this.database
      .from("account_deletion_requests")
      .select("id")
      .eq("user_id", userId)
      .in("request_status", ["pending", "processing"])
      .limit(1)
      .maybeSingle();
    if (activeError) throw databaseError("Your deletion request status could not be checked.");
    if (!active) {
      const { error } = await this.database.from("account_deletion_requests").insert({
        user_id: userId,
        request_status: "pending",
        scheduled_for: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (error) throw databaseError("Your deletion request could not be created.");
    }
    const deletionRequest = (await this.get(userId)).deletionRequest;
    if (!deletionRequest) throw databaseError("Your deletion request could not be loaded.");
    return deletionRequest;
  }

  async cancelDeletion(userId: string, requestId: string) {
    const { data, error } = await this.database
      .from("account_deletion_requests")
      .update({ request_status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("user_id", userId)
      .eq("request_status", "pending")
      .select("id")
      .maybeSingle();
    if (error) throw databaseError("Your deletion request could not be cancelled.");
    if (!data) throw new NotFoundError("No pending deletion request was found.");
    const deletionRequest = (await this.get(userId)).deletionRequest;
    if (!deletionRequest) throw databaseError("Your deletion request could not be loaded.");
    return deletionRequest;
  }
}


