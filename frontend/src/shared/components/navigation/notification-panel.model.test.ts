import { expect, it } from "vitest";
import { appointmentNotificationTypes } from "@echo/contracts";
import { notificationAnchor, notificationQuery, isAppointmentNotification, notificationHref } from "./notification-panel.model";
import type { NotificationItem } from "@/services/notifications";
it("classifies only actual backend appointment types, never titles or guessed event names", () => {
  for (const type of appointmentNotificationTypes) expect(isAppointmentNotification(type)).toBe(true);
  for (const type of ["professional_case_message", "professional_update", "analysis_completed", "appointment_canceled", "Appointment updated"]) expect(isAppointmentNotification(type)).toBe(false);
  expect(notificationQuery("Inbox")).toEqual({ status: "unread", category: "all" });
  expect(notificationQuery("General")).toEqual({ status: "all", category: "general" });
  expect(notificationQuery("Appointments")).toEqual({ status: "all", category: "appointments" });
});
it("anchors to the actual bell and clamps both viewport edges", () => {
  expect(notificationAnchor({ bottom: 76, right: 1300 }, 1440, 900)).toEqual({ top: 88, right: 140 });
  expect(notificationAnchor({ bottom: 890, right: 1439 }, 1440, 900)).toEqual({ top: 704, right: 16 });
  expect(notificationAnchor({ bottom: 80, right: 40 }, 390, 844).right).toBe(16);
});
it.each([
  ["identity_verification", "/settings/verification"], ["journal", "/journal/fictional"],
  ["grounding", "/tools/grounding"], ["data_export_request", "/settings/export"],
  ["account_deletion_request", "/settings/export"], ["trusted_contact", "/settings/trusted-contacts"],
  ["professional_case", "/professional-support/requests/fictional"],
])("preserves %s routing", (resourceType, target) => {
  expect(notificationHref({ resourceType, resourceId: "fictional" } as NotificationItem)).toBe(target);
});
