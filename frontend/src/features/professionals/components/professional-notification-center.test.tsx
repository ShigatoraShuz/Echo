import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import ProfessionalNotificationCenter from "./professional-notification-center";

const api = vi.hoisted(() => ({ notifications: vi.fn(), readNotification: vi.fn() }));
vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: api }));
const notice = { id: "synthetic-notice", kind: "case_updated", caseId: "fe000000-0000-4000-8000-000000000001", readAt: null, createdAt: "2026-10-20T08:00:00Z" };
const result = { items: [notice], total: 1, hasMore: false, limit: 50 };
const props = { organizationId: "org-one", role: "counselor", onClose: vi.fn(), anchor: { top: 80, right: 16 } };
afterEach(() => vi.resetAllMocks());

it("coalesces a pending read during Strict Mode replay and stores no clinical data", async () => {
  let resolve!: (value: typeof result) => void;
  api.notifications.mockReturnValue(new Promise<typeof result>(done => { resolve = done; }));
  render(<StrictMode><ProfessionalNotificationCenter {...props} /></StrictMode>);
  expect(api.notifications).toHaveBeenCalledTimes(1);
  await act(async () => resolve(result));
  expect(screen.getByText("1 unread", { exact: true })).toBeVisible();
  expect(localStorage.getItem("synthetic-notice")).toBeNull();
});

it("does not call a clinical notification source for administrative roles", () => {
  render(<ProfessionalNotificationCenter {...props} role="org_admin" />);
  expect(screen.getByText("No administrative notification source yet")).toBeVisible();
  expect(api.notifications).not.toHaveBeenCalled();
});

it("keeps the unread state until one server acknowledgment and ignores duplicate clicks", async () => {
  api.notifications.mockResolvedValue(result);
  let resolve!: (value: { id: string; readAt: string }) => void;
  api.readNotification.mockReturnValue(new Promise(done => { resolve = done; }));
  render(<ProfessionalNotificationCenter {...props} />);
  const button = await screen.findByRole("button", { name: "Mark read" });
  fireEvent.click(button); fireEvent.click(button);
  expect(api.readNotification).toHaveBeenCalledTimes(1);
  expect(screen.getByText("1 unread", { exact: true })).toBeVisible();
  await act(async () => resolve({ id: notice.id, readAt: "2026-10-20T10:00:00Z" }));
  expect(screen.getByText("0 unread", { exact: true })).toBeVisible();
});

it("conceals the list when read acknowledgment belongs to a different notification", async () => {
  api.notifications.mockResolvedValue(result);
  api.readNotification.mockResolvedValue({ id: "foreign-notice", readAt: "2026-10-20T10:00:00Z" });
  render(<ProfessionalNotificationCenter {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: "Mark read" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("link", { name: "Open case" })).not.toBeInTheDocument();
});

it("never treats a bounded response's loaded unread entries as the full unread count", async () => {
  api.notifications.mockResolvedValue({ ...result, total: 70, hasMore: true });
  render(<ProfessionalNotificationCenter {...props} />);
  await screen.findByText("1 unread in this view");
  expect(screen.queryByText("1 unread", { exact: true })).not.toBeInTheDocument();
  expect(screen.getByText(/Showing 1 of 70 updates/)).toBeVisible();
});

it("discards a previous organization's late response after keyed remount", async () => {
  let resolve!: (value: typeof result) => void;
  api.notifications.mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValue({ items: [], total: 0, hasMore: false, limit: 50 });
  const view = render(<ProfessionalNotificationCenter key="one" {...props} />);
  view.rerender(<ProfessionalNotificationCenter key="two" {...props} organizationId="org-two" />);
  await screen.findByText("No updates here yet");
  await act(async () => resolve(result));
  expect(screen.queryByText("Case updated", { exact: true })).not.toBeInTheDocument();
  await waitFor(() => expect(api.notifications).toHaveBeenCalledTimes(2));
});

it("filters safe chat, appointment and general updates with accessible controls and exact totals", async () => {
  api.notifications.mockResolvedValue({ ...result, unreadCount: 72, hasMore: true, total: 80, inAppEnabled: false,
    items: [notice, { ...notice, id: "chat", kind: "case_message" }, { ...notice, id: "appointment", kind: "appointment_changed" }] });
  render(<ProfessionalNotificationCenter {...props} />);
  await screen.findByText("72 unread", { exact: true });
  expect(screen.getByRole("status")).toHaveTextContent("In-app notifications are off");
  fireEvent.click(screen.getByRole("button", { name: "Messages" }));
  expect(screen.getByRole("button", { name: "Messages" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("New case message", { exact: true })).toBeVisible();
  expect(screen.queryByText("Case updated", { exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "General" }));
  expect(screen.getByText("Case updated", { exact: true })).toBeVisible();
  expect(screen.queryByText("New case message", { exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Appointments" }));
  expect(screen.getByText("Appointment updated", { exact: true })).toBeVisible();
});

it("refreshes an open panel on notification changes and removes it on access loss", async () => {
  api.notifications.mockResolvedValueOnce(result).mockResolvedValue({ ...result, items: [{ ...notice, kind: "case_message" }] });
  render(<ProfessionalNotificationCenter {...props} />);
  await screen.findByText("Case updated", { exact: true });
  act(() => window.dispatchEvent(new Event("echo:notifications-changed")));
  await screen.findByText("New case message", { exact: true });
  act(() => window.dispatchEvent(new Event("echo:professional-access-lost")));
  expect(screen.queryByRole("link", { name: "Open case" })).not.toBeInTheDocument();
  expect(props.onClose).toHaveBeenCalled();
});
