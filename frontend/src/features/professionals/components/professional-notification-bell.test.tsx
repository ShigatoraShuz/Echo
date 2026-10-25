import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProfessionalNotificationBell } from "./professional-notification-bell";
import { clearNotificationSound, enableNotificationSound } from "@/services/notifications/notification-sound";
import { settingsService } from "@/services/settings/settings.service";
const api = vi.hoisted(() => ({ notifications: vi.fn() }));
vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: api }));
vi.mock("@/services/settings/settings.service", () => ({ settingsService: { get: vi.fn() } }));
const page = (id: string) => ({
  items: [
    { id, kind: "appointment_changed", caseId: "synthetic-case", createdAt: "2026-10-24T10:00:00Z", readAt: null },
  ],
  total: 1,
  hasMore: false,
  limit: 50,
});
beforeEach(() => {
  clearNotificationSound();
  vi.clearAllMocks();
  localStorage.clear();
  api.notifications.mockResolvedValue(page("first"));
});
afterEach(() => { clearNotificationSound(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("discovers updates while closed without loading the clinical panel", async () => {
  render(<ProfessionalNotificationBell userId="actor" organizationId="one" role="counselor" />);
  await screen.findByRole("button", { name: "Notifications, 1 unread" });
  expect(api.notifications).toHaveBeenCalledWith("one");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("starts a new scope immediately, ignores a late old organization read, and clears clinical counts on role change", async () => {
  let resolve!: (value: unknown) => void;
  api.notifications.mockReturnValueOnce(new Promise((yes) => (resolve = yes)));
  const { rerender } = render(<ProfessionalNotificationBell userId="actor" organizationId="one" role="counselor" />);
  await waitFor(() => expect(api.notifications).toHaveBeenCalledTimes(1));
  rerender(<ProfessionalNotificationBell userId="actor" organizationId="two" role="counselor" />);
  await screen.findByRole("button", { name: "Notifications, 1 unread" });
  expect(api.notifications).toHaveBeenLastCalledWith("two");
  await act(async () =>
    resolve({
      ...page("old"),
      items: Array.from({ length: 9 }, (_, index) => ({ ...page("old").items[0], id: String(index) })),
    }),
  );
  expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible();
  rerender(<ProfessionalNotificationBell userId="actor" organizationId="two" role="org_admin" />);
  expect(screen.getByRole("button", { name: "Notifications" })).toBeVisible();
  expect(api.notifications).toHaveBeenCalledTimes(2);
});
it("clears and ignores a pending response after logout", async () => {
  let resolve!: (value: unknown) => void;
  api.notifications.mockReturnValue(new Promise((yes) => (resolve = yes)));
  render(<ProfessionalNotificationBell userId="actor" organizationId="one" role="counselor" />);
  act(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
  await act(async () => resolve(page("old")));
  expect(screen.getByRole("button", { name: "Notifications" })).toBeVisible();
  expect(screen.queryByText("1")).not.toBeInTheDocument();
});

it("uses exact server unread counts and refreshes them on acknowledgement signals", async () => {
  api.notifications.mockResolvedValueOnce({ ...page("chat"), unreadCount: 76, hasMore: true }).mockResolvedValue({ ...page("chat"), unreadCount: 75, hasMore: true });
  render(<ProfessionalNotificationBell userId="actor" organizationId="one" role="counselor" />);
  await screen.findByRole("button", { name: "Notifications, 76 unread" });
  act(() => window.dispatchEvent(new Event("echo:notifications-changed")));
  await screen.findByRole("button", { name: "Notifications, 75 unread" });
});

it("identifies an unavailable count instead of presenting a failed fetch as zero unread", async () => {
  api.notifications.mockRejectedValue(new Error("offline"));
  render(<ProfessionalNotificationBell userId="actor" organizationId="one" role="counselor" />);
  await screen.findByRole("button", { name: "Notifications, updates unavailable" });
});

it("connects real bell observations to explicitly enabled sound, silencing initial and duplicate snapshots", async () => {
  const started = vi.fn();
  vi.stubGlobal("AudioContext", vi.fn(function () { return {
    state: "running", currentTime: 0, destination: {}, resume: async () => {}, close: async () => {},
    createOscillator: () => ({ type: "sine", frequency: { value: 0 }, connect: vi.fn(), start: started, stop: vi.fn() }),
    createGain: () => ({ gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }),
  }; }));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.mocked(settingsService.get).mockResolvedValue({ notifications: { inAppEnabled: true } } as Awaited<ReturnType<typeof settingsService.get>>);
  await enableNotificationSound("actor", true); // the explicit user gesture unlocks audio
  started.mockClear();
  render(<ProfessionalNotificationBell userId="actor" organizationId="one" role="counselor" />);
  await screen.findByRole("button", { name: "Notifications, 1 unread" });
  expect(started).not.toHaveBeenCalled();
  api.notifications.mockResolvedValue({ ...page("new-chat"), items: [{ ...page("new-chat").items[0], kind: "case_message", createdAt: "2026-10-24T10:01:00Z" }] });
  act(() => window.dispatchEvent(new Event("echo:notifications-changed")));
  await waitFor(() => expect(started).toHaveBeenCalledTimes(2)); // two tones, one chime
  act(() => window.dispatchEvent(new Event("echo:appointments-changed")));
  await waitFor(() => expect(api.notifications).toHaveBeenCalledTimes(3));
  expect(started).toHaveBeenCalledTimes(2);
});
