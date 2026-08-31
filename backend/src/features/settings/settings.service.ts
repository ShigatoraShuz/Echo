import type { SupabaseClient } from "@supabase/supabase-js";
import { logSupabaseError, type SupabaseOperation } from "../../infrastructure/supabase/supabase-diagnostics.js";
import { AuthenticationError, ExternalServiceError, NotFoundError } from "../../shared/errors/app-error.js";

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
  journalAiAnalysisEnabled?: boolean;
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

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface AvatarUploadInput {
  contents: Buffer;
  mimeType: string;
  sizeBytes: number;
}

export interface SecurityAuditEvent {
  id: string;
  eventType: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

type Row = Record<string, unknown>;

const AVATAR_BUCKET = "avatars";
const avatarExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function databaseError(message: string): ExternalServiceError {
  return new ExternalServiceError("DATABASE_UNAVAILABLE", message);
}

function storageError(message: string): ExternalServiceError {
  return new ExternalServiceError("STORAGE_UNAVAILABLE", message);
}

function throwIfDatabaseError(error: unknown, operation: SupabaseOperation, message: string): void {
  if (!error) return;
  logSupabaseError(operation, error as Parameters<typeof logSupabaseError>[1]);
  throw databaseError(message);
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

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export class SettingsService {
  constructor(private readonly database: SupabaseClient) {}

  private async recordAudit(
    userId: string,
    eventType: string,
    options: { resourceType?: string; resourceId?: string; metadata?: Record<string, unknown> } = {},
  ): Promise<void> {
    const { error } = await this.database
      .schema("user_service")
      .from("audit_events")
      .insert({
        user_id: userId,
        actor_user_id: userId,
        event_type: eventType,
        resource_type: options.resourceType ?? null,
        resource_id: options.resourceId ?? null,
        metadata: options.metadata ?? {},
      });
    if (!error) return;
    logSupabaseError(
      { module: "settings.audit", schema: "user_service", table: "audit_events", operation: `insert ${eventType}` },
      error as Parameters<typeof logSupabaseError>[1],
    );
  }

  private async ensureDefaults(userId: string): Promise<void> {
    const [profile, notifications, privacy] = await Promise.all([
      this.database
        .schema("user_service")
        .from("profiles")
        .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true }),
      this.database
        .schema("user_service")
        .from("notification_preferences")
        .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true }),
      this.database
        .schema("user_service")
        .from("privacy_preferences")
        .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true }),
    ]);
    throwIfDatabaseError(
      profile.error,
      { module: "settings", schema: "user_service", table: "profiles", operation: "upsert defaults" },
      "Your settings could not be prepared.",
    );
    throwIfDatabaseError(
      notifications.error,
      { module: "settings", schema: "user_service", table: "notification_preferences", operation: "upsert defaults" },
      "Your settings could not be prepared.",
    );
    throwIfDatabaseError(
      privacy.error,
      { module: "settings", schema: "user_service", table: "privacy_preferences", operation: "upsert defaults" },
      "Your settings could not be prepared.",
    );
  }

  async get(userId: string) {
    await this.ensureDefaults(userId);
    const [profileResult, notificationResult, privacyResult, contactsResult, exportResult, deletionResult] =
      await Promise.all([
        this.database
          .schema("user_service")
          .from("profiles")
          .select("display_name, timezone, theme_variant, theme_mode, avatar_path")
          .eq("user_id", userId)
          .maybeSingle(),
        this.database
          .schema("user_service")
          .from("notification_preferences")
          .select(
            "email_enabled, push_enabled, in_app_enabled, journal_reminders_enabled, wellbeing_reminders_enabled, insight_notifications_enabled, reminder_time, reminder_timezone",
          )
          .eq("user_id", userId)
          .maybeSingle(),
        this.database
          .schema("user_service")
          .from("privacy_preferences")
          .select("facial_analysis_enabled, crisis_support_visible, lock_screen_private")
          .eq("user_id", userId)
          .maybeSingle(),
        this.database
          .schema("user_service")
          .from("trusted_contacts")
          .select(
            "id, contact_name, contact_email, contact_phone, relationship, verified, is_primary, permission_acknowledged_at, created_at, updated_at",
          )
          .eq("user_id", userId)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: true }),
        this.database
          .schema("user_service")
          .from("data_export_requests")
          .select("id, request_status, requested_at, completed_at, expires_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10),
        this.database
          .schema("user_service")
          .from("account_deletion_requests")
          .select("id, request_status, requested_at, scheduled_for, cancelled_at, completed_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    throwIfDatabaseError(
      profileResult.error,
      { module: "settings", schema: "user_service", table: "profiles", operation: "select settings profile" },
      "Your settings could not be loaded.",
    );
    throwIfDatabaseError(
      notificationResult.error,
      {
        module: "settings",
        schema: "user_service",
        table: "notification_preferences",
        operation: "select notification preferences",
      },
      "Your settings could not be loaded.",
    );
    throwIfDatabaseError(
      privacyResult.error,
      {
        module: "settings",
        schema: "user_service",
        table: "privacy_preferences",
        operation: "select privacy preferences",
      },
      "Your settings could not be loaded.",
    );
    throwIfDatabaseError(
      contactsResult.error,
      { module: "settings", schema: "user_service", table: "trusted_contacts", operation: "select trusted contacts" },
      "Your settings could not be loaded.",
    );
    throwIfDatabaseError(
      exportResult.error,
      {
        module: "settings",
        schema: "user_service",
        table: "data_export_requests",
        operation: "select export requests",
      },
      "Your settings could not be loaded.",
    );
    throwIfDatabaseError(
      deletionResult.error,
      {
        module: "settings",
        schema: "user_service",
        table: "account_deletion_requests",
        operation: "select latest deletion request",
      },
      "Your settings could not be loaded.",
    );

    const profile = profileResult.data as Row | null;
    const notifications = notificationResult.data as Row | null;
    const privacy = privacyResult.data as Row | null;
    const trustedContacts = (contactsResult.data ?? []) as Row[];
    const exportRows = (exportResult.data ?? []) as Row[];
    const latestDeletion = deletionResult.data;
    const exportHistory = exportRows.map((exportRequest) => ({
      id: stringValue(exportRequest.id),
      status: stringValue(exportRequest.request_status),
      requestedAt: stringValue(exportRequest.requested_at),
      completedAt: nullableString(exportRequest.completed_at),
      expiresAt: nullableString(exportRequest.expires_at),
    }));

    return {
      profile: {
        displayName: stringValue(profile?.display_name),
        timezone: stringValue(profile?.timezone, "Asia/Manila"),
        themeVariant: stringValue(profile?.theme_variant, "echo-calm"),
        themeMode: stringValue(profile?.theme_mode, "system"),
        avatarPath: nullableString(profile?.avatar_path),
      },
      privacy: {
        journalPrivate: true,
        facialAnalysisEnabled: booleanValue(privacy?.facial_analysis_enabled),
        journalAiAnalysisEnabled: booleanValue(privacy?.journal_ai_analysis_enabled),
        crisisSupportVisible: booleanValue(privacy?.crisis_support_visible, true),
        lockScreenPrivate: booleanValue(privacy?.lock_screen_private, true),
      },
      notifications: {
        emailEnabled: booleanValue(notifications?.email_enabled),
        pushEnabled: booleanValue(notifications?.push_enabled),
        inAppEnabled: booleanValue(notifications?.in_app_enabled, true),
        journalRemindersEnabled: booleanValue(notifications?.journal_reminders_enabled),
        wellbeingRemindersEnabled: booleanValue(notifications?.wellbeing_reminders_enabled),
        insightNotificationsEnabled: booleanValue(notifications?.insight_notifications_enabled),
        reminderTime: nullableString(notifications?.reminder_time)?.slice(0, 5) ?? null,
        reminderTimezone: nullableString(notifications?.reminder_timezone),
      },
      trustedContacts: trustedContacts.map((contact) => ({
        id: stringValue(contact.id),
        contactName: stringValue(contact.contact_name),
        contactEmail: nullableString(contact.contact_email),
        contactPhone: nullableString(contact.contact_phone),
        relationship: stringValue(contact.relationship),
        verified: booleanValue(contact.verified),
        isPrimary: booleanValue(contact.is_primary),
        permissionAcknowledged: contact.permission_acknowledged_at != null,
      })),
      latestExport: exportHistory[0] ?? null,
      exportHistory,
      deletionRequest: latestDeletion
        ? {
            id: stringValue((latestDeletion as Row).id),
            status: stringValue((latestDeletion as Row).request_status),
            requestedAt: stringValue((latestDeletion as Row).requested_at),
            scheduledFor: nullableString((latestDeletion as Row).scheduled_for),
            cancelledAt: nullableString((latestDeletion as Row).cancelled_at),
            completedAt: nullableString((latestDeletion as Row).completed_at),
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
      .schema("user_service")
      .from("profiles")
      .update(updatePayload)
      .eq("user_id", userId);
    if (error) throw databaseError("Your profile settings could not be saved.");
    await this.recordAudit(userId, "settings.profile_updated", { resourceType: "profile" });
    return this.get(userId);
  }

  async uploadAvatar(userId: string, input: AvatarUploadInput) {
    await this.ensureDefaults(userId);
    const extension = avatarExtensions[input.mimeType];
    if (!extension) throw databaseError("Your profile photo type is not supported.");

    const storagePath = `${userId}/profile.${extension}`;
    const { error: uploadError } = await this.database.storage.from(AVATAR_BUCKET).upload(storagePath, input.contents, {
      contentType: input.mimeType,
      upsert: true,
    });
    if (uploadError) {
      logSupabaseError(
        { module: "settings.avatar", schema: "storage", table: AVATAR_BUCKET, operation: "upload profile avatar" },
        uploadError,
      );
      throw storageError("Profile photo storage is not available. Please try again after setup is complete.");
    }

    const { data } = this.database.storage.from(AVATAR_BUCKET).getPublicUrl(storagePath);
    const avatarPath = data.publicUrl || storagePath;
    const { error: profileError } = await this.database
      .schema("user_service")
      .from("profiles")
      .update({ avatar_path: avatarPath })
      .eq("user_id", userId);
    if (profileError) throw databaseError("Your profile photo could not be saved.");

    await this.recordAudit(userId, "settings.avatar_updated", {
      resourceType: "profile",
      metadata: { mimeType: input.mimeType, sizeBytes: input.sizeBytes },
    });
    return this.get(userId);
  }

  async updatePrivacy(userId: string, input: PrivacySettingsInput) {
    await this.ensureDefaults(userId);
    const { error } = await this.database
      .schema("user_service")
      .from("privacy_preferences")
      .update({
        facial_analysis_enabled: input.facialAnalysisEnabled,
        ...(input.journalAiAnalysisEnabled !== undefined
          ? { journal_ai_analysis_enabled: input.journalAiAnalysisEnabled }
          : {}),
        crisis_support_visible: input.crisisSupportVisible,
        lock_screen_private: input.lockScreenPrivate,
      })
      .eq("user_id", userId);
    if (error) throw databaseError("Your privacy settings could not be saved.");
    await this.recordAudit(userId, "settings.privacy_updated", { resourceType: "privacy_preferences" });
    return this.get(userId);
  }

  async updateNotifications(userId: string, input: NotificationSettingsInput) {
    await this.ensureDefaults(userId);
    const { error } = await this.database
      .schema("user_service")
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
    await this.recordAudit(userId, "settings.notifications_updated", { resourceType: "notification_preferences" });
    return this.get(userId);
  }

  async createContact(userId: string, input: TrustedContactInput) {
    if (input.isPrimary) {
      const { error } = await this.database
        .schema("user_service")
        .from("trusted_contacts")
        .update({ is_primary: false })
        .eq("user_id", userId);
      if (error) throw databaseError("Your trusted contacts could not be updated.");
    }
    const { data, error } = await this.database
      .schema("user_service")
      .from("trusted_contacts")
      .insert({
        user_id: userId,
        contact_name: input.contactName,
        contact_email: input.contactEmail,
        contact_phone: input.contactPhone,
        relationship: input.relationship,
        is_primary: input.isPrimary,
        permission_acknowledged_at: input.permissionAcknowledged ? new Date().toISOString() : null,
      })
      .select("id")
      .maybeSingle();
    if (error) throw databaseError("The trusted contact could not be added.");
    await this.recordAudit(userId, "settings.trusted_contact_created", {
      resourceType: "trusted_contact",
      resourceId: stringValue((data as Row | null)?.id) || undefined,
      metadata: {
        isPrimary: input.isPrimary,
        hasEmail: Boolean(input.contactEmail),
        hasPhone: Boolean(input.contactPhone),
      },
    });
    return this.get(userId);
  }

  async updateContact(userId: string, contactId: string, input: TrustedContactInput) {
    if (input.isPrimary) {
      const { error } = await this.database
        .schema("user_service")
        .from("trusted_contacts")
        .update({ is_primary: false })
        .eq("user_id", userId)
        .neq("id", contactId);
      if (error) throw databaseError("Your trusted contacts could not be updated.");
    }
    const { data, error } = await this.database
      .schema("user_service")
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
    await this.recordAudit(userId, "settings.trusted_contact_updated", {
      resourceType: "trusted_contact",
      resourceId: contactId,
      metadata: {
        isPrimary: input.isPrimary,
        hasEmail: Boolean(input.contactEmail),
        hasPhone: Boolean(input.contactPhone),
      },
    });
    return this.get(userId);
  }

  async removeContact(userId: string, contactId: string) {
    const { data, error } = await this.database
      .schema("user_service")
      .from("trusted_contacts")
      .delete()
      .eq("id", contactId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    if (error) throw databaseError("The trusted contact could not be removed.");
    if (!data) throw new NotFoundError("The trusted contact was not found.");
    await this.recordAudit(userId, "settings.trusted_contact_deleted", {
      resourceType: "trusted_contact",
      resourceId: contactId,
    });
    return this.get(userId);
  }

  async requestExport(userId: string) {
    const { data: active, error: activeError } = await this.database
      .schema("user_service")
      .from("data_export_requests")
      .select("id")
      .eq("user_id", userId)
      .in("request_status", ["requested", "processing"])
      .limit(1)
      .maybeSingle();
    if (activeError) throw databaseError("Your export status could not be checked.");
    if (!active) {
      const { error } = await this.database
        .schema("user_service")
        .from("data_export_requests")
        .insert({ user_id: userId, request_status: "requested" });
      if (error) throw databaseError("Your export request could not be created.");
    }
    await this.recordAudit(userId, "settings.data_export_requested", { resourceType: "data_export_request" });
    return this.get(userId);
  }

  async requestDeletion(userId: string) {
    const { data: active, error: activeError } = await this.database
      .schema("user_service")
      .from("account_deletion_requests")
      .select("id")
      .eq("user_id", userId)
      .in("request_status", ["pending", "processing"])
      .limit(1)
      .maybeSingle();
    if (activeError) throw databaseError("Your deletion request status could not be checked.");
    if (!active) {
      const { error } = await this.database
        .schema("user_service")
        .from("account_deletion_requests")
        .insert({
          user_id: userId,
          request_status: "pending",
          scheduled_for: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      if (error) throw databaseError("Your deletion request could not be created.");
    }
    await this.recordAudit(userId, "settings.account_deletion_requested", { resourceType: "account_deletion_request" });
    return this.get(userId);
  }

  async cancelDeletion(userId: string, requestId: string) {
    const { data, error } = await this.database
      .schema("user_service")
      .from("account_deletion_requests")
      .update({ request_status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("user_id", userId)
      .eq("request_status", "pending")
      .select("id")
      .maybeSingle();
    if (error) throw databaseError("Your deletion request could not be cancelled.");
    if (!data) throw new NotFoundError("No pending deletion request was found.");
    await this.recordAudit(userId, "settings.account_deletion_cancelled", {
      resourceType: "account_deletion_request",
      resourceId: requestId,
    });
    return this.get(userId);
  }

  async changePassword(
    userId: string,
    email: string | undefined,
    input: ChangePasswordInput,
  ): Promise<{ passwordChanged: true }> {
    if (!email) throw new ExternalServiceError("AUTH_UNAVAILABLE", "Your account email could not be verified.");

    const { error: verifyError } = await this.database.auth.signInWithPassword({
      email,
      password: input.currentPassword,
    });
    if (verifyError) {
      await this.recordAudit(userId, "security.password_change_failed", {
        resourceType: "auth_user",
        metadata: { reason: "invalid_current_password" },
      });
      throw new AuthenticationError("INVALID_CURRENT_PASSWORD", "The current password is incorrect.");
    }

    const { error: updateError } = await this.database.auth.admin.updateUserById(userId, {
      password: input.newPassword,
    });
    if (updateError) throw new ExternalServiceError("AUTH_UNAVAILABLE", "Your password could not be changed.");

    await this.recordAudit(userId, "security.password_changed", { resourceType: "auth_user" });
    return { passwordChanged: true };
  }

  async listSecurityAuditEvents(userId: string, limit: number): Promise<{ auditEvents: SecurityAuditEvent[] }> {
    const { data, error } = await this.database
      .schema("user_service")
      .from("audit_events")
      .select("id, event_type, resource_type, resource_id, metadata, created_at")
      .or(`user_id.eq.${userId},actor_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(limit);
    throwIfDatabaseError(
      error,
      {
        module: "settings.security",
        schema: "user_service",
        table: "audit_events",
        operation: "select security audit events",
      },
      "Security history could not be loaded.",
    );
    return {
      auditEvents: ((data ?? []) as Row[]).map((row) => ({
        id: stringValue(row.id),
        eventType: stringValue(row.event_type),
        resourceType: nullableString(row.resource_type),
        resourceId: nullableString(row.resource_id),
        metadata: objectValue(row.metadata),
        createdAt: stringValue(row.created_at),
      })),
    };
  }

  async signOutAllDevices(userId: string, accessToken: string): Promise<{ signedOut: true }> {
    const { error } = await this.database.auth.admin.signOut(accessToken, "global");
    if (error) throw new ExternalServiceError("AUTH_UNAVAILABLE", "All devices could not be signed out.");
    await this.recordAudit(userId, "security.sign_out_all_devices", { resourceType: "auth_session" });
    return { signedOut: true };
  }
}
