import type { SupabaseClient } from "@supabase/supabase-js";
import { logSupabaseError, type SupabaseOperation } from "../../infrastructure/supabase/supabase-diagnostics.js";
import { ExternalServiceError, NotFoundError } from "../../shared/errors/app-error.js";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  resourceType: string | null;
  resourceId: string | null;
  resourceLabel?: string | null;
  readAt: string | null;
  createdAt: string;
}

type Row = Record<string, unknown>;

function databaseError(message: string): ExternalServiceError {
  return new ExternalServiceError("DATABASE_UNAVAILABLE", message);
}

function throwIfDatabaseError(error: unknown, operation: SupabaseOperation, message: string): void {
  if (!error) return;
  logSupabaseError(operation, error as Parameters<typeof logSupabaseError>[1]);
  throw databaseError(message);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mapNotification(row: Row): NotificationItem {
  return {
    id: stringValue(row.id),
    type: stringValue(row.notification_type),
    title: stringValue(row.title),
    message: stringValue(row.message),
    resourceType: nullableString(row.resource_type),
    resourceId: nullableString(row.resource_id),
    readAt: nullableString(row.read_at),
    createdAt: stringValue(row.created_at),
  };
}

export class NotificationService {
  constructor(
    private readonly database: SupabaseClient,
    private readonly journalTitleResolver?: (userId: string, journalIds: string[]) => Promise<Map<string, string>>,
  ) {}

  private async withResourceLabels(userId: string, notifications: NotificationItem[]): Promise<NotificationItem[]> {
    if (!this.journalTitleResolver) return notifications;
    const journalIds = notifications
      .filter((item) => item.resourceType === "journal" && item.resourceId)
      .map((item) => item.resourceId as string);
    if (journalIds.length === 0) return notifications;
    const titles = await this.journalTitleResolver(userId, journalIds);
    return notifications.map((item) => ({
      ...item,
      resourceLabel: item.resourceType === "journal" && item.resourceId ? titles.get(item.resourceId) ?? null : null,
    }));
  }

  async list(userId: string, options: { status: "all" | "unread"; limit: number }) {
    let query = this.database
      .schema("notification_service")
      .from("notifications")
      .select("id, notification_type, title, message, resource_type, resource_id, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(options.limit);

    if (options.status === "unread") {
      query = query.is("read_at", null);
    }

    const { data, error } = await query;
    throwIfDatabaseError(error, { module: "notifications", schema: "notification_service", table: "notifications", operation: "select notifications" }, "Notifications could not be loaded.");
    return { notifications: await this.withResourceLabels(userId, ((data ?? []) as Row[]).map(mapNotification)) };
  }

  async markRead(userId: string, notificationId: string) {
    const { data, error } = await this.database
      .schema("notification_service")
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", userId)
      .select("id, notification_type, title, message, resource_type, resource_id, read_at, created_at")
      .maybeSingle();
    throwIfDatabaseError(error, { module: "notifications", schema: "notification_service", table: "notifications", operation: "mark notification read" }, "Notification could not be updated.");
    if (!data) throw new NotFoundError("Notification was not found.");
    const [notification] = await this.withResourceLabels(userId, [mapNotification(data as Row)]);
    return { notification };
  }

  async markAllRead(userId: string) {
    const { error } = await this.database
      .schema("notification_service")
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    throwIfDatabaseError(error, { module: "notifications", schema: "notification_service", table: "notifications", operation: "mark all notifications read" }, "Notifications could not be updated.");
    return this.list(userId, { status: "all", limit: 20 });
  }
}
