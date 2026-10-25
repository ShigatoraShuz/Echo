import { appointmentNotificationTypes, type NotificationCategory } from "@echo/contracts";
import type { NotificationItem, NotificationStatusFilter } from "@/services/notifications";
export const notificationTabs = ["All", "Inbox", "General", "Appointments"] as const;
export type NotificationTab = typeof notificationTabs[number];
export function notificationQuery(tab: NotificationTab): { status: NotificationStatusFilter; category: NotificationCategory } {
  return { status: tab === "Inbox" ? "unread" : "all", category: tab === "General" ? "general" : tab === "Appointments" ? "appointments" : "all" };
}
export const isAppointmentNotification = (type: string) => (appointmentNotificationTypes as readonly string[]).includes(type);
export function notificationAnchor(rect: Pick<DOMRect, "bottom" | "right">, width: number, height: number) {
  const panelWidth = Math.min(440, width - 32);
  return { top: Math.max(16, Math.min(rect.bottom + 12, height - 196)), right: Math.max(16, Math.min(width - rect.right, width - panelWidth - 16)) };
}
export function notificationHref(item: NotificationItem): string | null {
  switch (item.resourceType) {
    case "identity_verification": return "/settings/verification";
    case "journal": return item.resourceId ? `/journal/${encodeURIComponent(item.resourceId)}` : "/journal";
    case "grounding": return "/tools/grounding";
    case "data_export_request":
    case "account_deletion_request": return "/settings/export";
    case "trusted_contact": return "/settings/trusted-contacts";
    case "professional_case": return item.resourceId ? `/professional-support/requests/${encodeURIComponent(item.resourceId)}` : "/professional-support";
    default: return null;
  }
}
