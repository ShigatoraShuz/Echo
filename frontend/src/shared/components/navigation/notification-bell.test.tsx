import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "./notification-bell";
import { notificationsService, type NotificationItem } from "@/services/notifications";

vi.mock("@/services/notifications", () => ({
  notificationsService: {
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

const sound = vi.hoisted(() => ({ actor: "student-one", observe: vi.fn() }));
vi.mock("@/shared/hooks/use-notification-sound", () => ({ useNotificationSound: () => sound }));

const unreadNotification = {
  id: "notification-1",
  type: "verification_status",
  title: "Verification update",
  message: "Your verification request was reviewed.",
  resourceType: "identity_verification",
  resourceId: "verification-1",
  readAt: null,
  createdAt: "2026-08-25T01:00:00.000Z",
};

const readNotification = {
  ...unreadNotification,
  id: "notification-2",
  title: "Export ready",
  resourceType: "data_export_request",
  resourceId: "export-1",
  readAt: "2026-08-25T02:00:00.000Z",
};

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sound.actor = "student-one";
    vi.mocked(notificationsService.list).mockResolvedValue({
      notifications: [unreadNotification, readNotification],
    });
    vi.mocked(notificationsService.markRead).mockResolvedValue({
      notification: {
        ...unreadNotification,
        readAt: "2026-08-25T03:00:00.000Z",
      },
    });
    vi.mocked(notificationsService.markAllRead).mockResolvedValue({
      notifications: [
        { ...unreadNotification, readAt: "2026-08-25T03:00:00.000Z" },
        readNotification,
      ],
    });
  });

  it("opens an anchored panel with unread count and category tabs", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    expect(await screen.findByRole("button", { name: /notifications, 1 unread/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /notifications, 1 unread/i }));

    expect(screen.getByRole("dialog", { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByText("1 unread notification")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "All", selected: true })).toBeVisible();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveClass("user-notification-panel");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /notifications, 1 unread/i })).toHaveFocus();
  });

  it("uses the server's full unread count beyond the visible page", async () => {
    const user = userEvent.setup();
    vi.mocked(notificationsService.list).mockResolvedValue({
      notifications: [unreadNotification],
      unreadCount: 24,
    });
    render(<NotificationBell />);

    await user.click(await screen.findByRole("button", { name: "Notifications, 24 unread" }));
    expect(screen.getByText("24 unread notifications")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: /verification update/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Notifications, 23 unread" })).toBeInTheDocument());
  });

  it("marks one notification read when clicked", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    await user.click(await screen.findByRole("button", { name: /notifications, 1 unread/i }));
    expect(screen.getByRole("link", { name: /verification update/i })).toHaveAttribute(
      "href", "/settings/verification",
    );
    await user.click(screen.getByRole("link", { name: /verification update/i }));

    await waitFor(() => {
      expect(notificationsService.markRead).toHaveBeenCalledWith("notification-1");
    });
  });

  it("marks all notifications read", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    await user.click(await screen.findByRole("button", { name: /notifications, 1 unread/i }));
    await user.click(screen.getByRole("button", { name: /mark all read/i }));

    await waitFor(() => {
      expect(notificationsService.markAllRead).toHaveBeenCalledTimes(1);
    });
  });

  it("retries a failed notification load", async () => {
    const user = userEvent.setup();
    vi.mocked(notificationsService.list)
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"));
    render(<NotificationBell />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Verification update")).toBeInTheDocument();
    expect(notificationsService.list).toHaveBeenCalledTimes(3);
  });

  it("keeps the latest filter result when an older request finishes last", async () => {
    const pending: Array<(value: { notifications: NotificationItem[] }) => void> = [];
    vi.mocked(notificationsService.list).mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    const user = userEvent.setup();
    render(<NotificationBell />);
    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(screen.getByRole("tab", { name: "Inbox" }));

    await act(async () => pending[1]({ notifications: [unreadNotification] }));
    expect(await screen.findByText("Verification update")).toBeInTheDocument();
    await act(async () => {
      pending[0]({ notifications: [readNotification] });

    });
    expect(screen.getByText("Verification update")).toBeInTheDocument();
    expect(screen.queryByText("Export ready")).not.toBeInTheDocument();
  });

  it("removes a read item from the unread-only view", async () => {
    const user = userEvent.setup();
    vi.mocked(notificationsService.list).mockResolvedValue({ notifications: [{ ...unreadNotification, resourceType: null }] });
    render(<NotificationBell />);
    await user.click(await screen.findByRole("button", { name: /notifications, 1 unread/i }));
    await user.click(screen.getByRole("tab", { name: "Inbox" }));
    await user.click(await screen.findByRole("button", { name: /verification update/i }));
    await waitFor(() => expect(screen.getByText(/all caught up/)).toBeInTheDocument());
  });

  it("opens an in-app grounding invitation at the grounding page", async () => {
    vi.mocked(notificationsService.list).mockResolvedValue({ notifications: [{
      ...unreadNotification,
      type: "grounding_reminder",
      title: "A moment to pause",
      resourceType: "grounding",
      resourceId: null,
    }] });
    const user = userEvent.setup();
    render(<NotificationBell />);
    await user.click(await screen.findByRole("button", { name: /notifications, 1 unread/i }));
    expect(screen.getByRole("link", { name: /a moment to pause/i })).toHaveAttribute("href", "/tools/grounding");
  });

  it("refreshes the inbox when a background tab becomes visible", async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(notificationsService.list).toHaveBeenCalledTimes(1));
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(notificationsService.list).toHaveBeenCalledTimes(2));
  });

  it("uses server category queries, supports keyboard tabs and does not sound on category browsing", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);
    await user.click(await screen.findByRole("button", { name: /notifications, 1 unread/i }));
    await waitFor(() => expect(screen.queryByText("Loading notifications")).not.toBeInTheDocument());
    const observations = sound.observe.mock.calls.length;
    await user.click(screen.getByRole("tab", { name: "General" }));
    expect(notificationsService.list).toHaveBeenLastCalledWith("all", 20, { category: "general" });
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Appointments", selected: true })).toHaveFocus();
    expect(notificationsService.list).toHaveBeenLastCalledWith("all", 20, { category: "appointments" });
    expect(sound.observe).toHaveBeenCalledTimes(observations);
  });

  it("loads additional matching pages without duplicate rows or sound", async () => {
    const user = userEvent.setup();
    vi.mocked(notificationsService.list).mockResolvedValue({ notifications: [unreadNotification], unreadCount: 24, nextCursor: "fictional-cursor" });
    render(<NotificationBell />);
    await user.click(await screen.findByRole("button", { name: /notifications, 24 unread/i }));
    const more = await screen.findByRole("button", { name: "Load more updates" });
    const observations = sound.observe.mock.calls.length;
    vi.mocked(notificationsService.list).mockResolvedValue({ notifications: [unreadNotification, readNotification], unreadCount: 24, nextCursor: null });
    await user.click(more);
    expect(notificationsService.list).toHaveBeenLastCalledWith("all", 20, { category: "all", before: "fictional-cursor" });
    expect(await screen.findByText("Export ready")).toBeVisible();
    expect(screen.getAllByText("Verification update")).toHaveLength(1);
    expect(sound.observe).toHaveBeenCalledTimes(observations);
  });

  it("closes on outside click and button toggle, restoring focus", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);
    const trigger = await screen.findByRole("button", { name: /notifications, 1 unread/i });
    await user.click(trigger);
    await user.click(document.querySelector(".user-notification-backdrop")!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.click(trigger); await user.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clears on logout and discards pending requests and mutation acknowledgements", async () => {
    const user = userEvent.setup();
    let resolve!: (value: { notification: NotificationItem }) => void;
    vi.mocked(notificationsService.markRead).mockReturnValue(new Promise(done => { resolve = done; }));
    render(<NotificationBell />);
    await user.click(await screen.findByRole("button", { name: /notifications, 1 unread/i }));
    await user.click(await screen.findByRole("link", { name: /verification update/i }));
    act(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
    await act(async () => resolve({ notification: { ...unreadNotification, readAt: new Date().toISOString() } }));
    expect(screen.getByRole("button", { name: "Notifications" })).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Verification update")).not.toBeInTheDocument();
  });

  it("discards a previous account's late list when the current actor changes", async () => {
    let resolve!: (value: { notifications: NotificationItem[] }) => void;
    vi.mocked(notificationsService.list).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const view = render(<NotificationBell />);
    sound.actor = "student-two";
    vi.mocked(notificationsService.list).mockResolvedValue({ notifications: [], unreadCount: 0 });
    view.rerender(<NotificationBell />);
    await act(async () => resolve({ notifications: [unreadNotification] }));
    expect(screen.getByRole("button", { name: "Notifications" })).toBeVisible();
  });

  it.each([["General", "No general updates"], ["Appointments", "No appointment updates"]])("shows a true empty %s category after its server query", async (category, title) => {
    const user = userEvent.setup();
    render(<NotificationBell />);
    await user.click(await screen.findByRole("button", { name: /notifications, 1 unread/i }));
    vi.mocked(notificationsService.list).mockResolvedValue({ notifications: [], unreadCount: 1, nextCursor: null });
    await user.click(screen.getByRole("tab", { name: category }));
    expect(await screen.findByText(title)).toBeVisible();
    expect(screen.getByText("1 unread notification")).toBeVisible();
  });
});
