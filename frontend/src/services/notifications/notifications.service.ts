import { env } from "@/config/environment";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import type { NotificationCategory } from "@echo/contracts";

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

export type NotificationStatusFilter = "all" | "unread";

interface NotificationList {
  notifications: NotificationItem[];
  unreadCount?: number;
  nextCursor?: string | null;
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
    throw new Error("Notifications service returned an unsuccessful response.");
  }
  return envelope.data;
}

export const notificationsService = {
  list(status: NotificationStatusFilter = "all", limit = 20, options: { category?: NotificationCategory; before?: string } = {}) {
    const params = new URLSearchParams({ status, limit: String(limit) });
    if (options.category) params.set("category", options.category);
    if (options.before) params.set("before", options.before);
    return unwrap(client.get<ApiEnvelope<NotificationList>>(`/notifications?${params}`));
  },
  markRead(notificationId: string) {
    return unwrap(client.patch<ApiEnvelope<{ notification: NotificationItem }>>(
      `/notifications/${encodeURIComponent(notificationId)}/read`,
    ));
  },
  markAllRead() {
    return unwrap(client.patch<ApiEnvelope<NotificationList>>("/notifications/read-all"));
  },
  registerPush(subscription: PushSubscriptionJSON) {
    return unwrap(client.post<ApiEnvelope<{ registered: boolean }>, PushSubscriptionJSON>(
      "/notifications/push/subscriptions", subscription,
    ));
  },
  unregisterPush(endpoint: string) {
    return unwrap(client.post<ApiEnvelope<{ registered: boolean }>, { endpoint: string }>(
      "/notifications/push/unsubscribe", { endpoint },
    ));
  },
};
