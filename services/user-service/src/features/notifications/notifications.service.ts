import type { OwnedDatabase } from "@echo/service-core";
import { ServiceError } from "@echo/service-core";

type Row = Record<string, unknown>;

export interface CreateNotificationInput {
  userId: string;
  notificationType: string;
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
}

function mapNotification(row: Row) {
  return {
    id: row.id,
    type: row.notification_type,
    title: row.title,
    message: row.message,
    resourceType: row.resource_type ?? null,
    resourceId: row.resource_id ?? null,
    resourceLabel: row.resource_label ?? null,
    readAt: row.read_at ?? null,
    createdAt: row.created_at,
  };
}

function unavailable(message: string): ServiceError {
  return new ServiceError(503, "DATABASE_UNAVAILABLE", message);
}

export class NotificationsService {
  constructor(private readonly database: OwnedDatabase) {}

  async list(userId: string, status: "all" | "unread", limit: number) {
    let query = this.database
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status === "unread") query = query.is("read_at", null);
    const { data, error } = await query;
    if (error) throw unavailable("Notifications could not be loaded.");
    return (data ?? []).map((row: Row) => mapNotification(row));
  }

  async markAllRead(userId: string) {
    const { error } = await this.database
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw unavailable("Notifications could not be marked as read.");
    return this.list(userId, "all", 20);
  }

  async markRead(userId: string, notificationId: string) {
    const { data, error } = await this.database
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw unavailable("The notification could not be updated.");
    if (!data) throw new ServiceError(404, "NOT_FOUND", "The notification was not found.");
    return mapNotification(data as Row);
  }

  async create(input: CreateNotificationInput) {
    const { data, error } = await this.database
      .from("notifications")
      .insert({
        user_id: input.userId,
        notification_type: input.notificationType,
        title: input.title,
        message: input.message,
        resource_type: input.resourceType,
        resource_id: input.resourceId,
      })
      .select("*")
      .single();
    if (error || !data) throw unavailable("The notification could not be saved.");
    return mapNotification(data as Row);
  }
}
