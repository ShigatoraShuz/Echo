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

  it("opens a modal with unread count and filter controls", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    expect(await screen.findByRole("button", { name: /notifications, 1 unread/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /notifications, 1 unread/i }));

    expect(screen.getByRole("dialog", { name: /gentle updates/i })).toBeInTheDocument();
    expect(screen.getByText("1 unread notification")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /show/i })).toHaveValue("all");
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
    await user.selectOptions(screen.getByRole("combobox", { name: /show/i }), "unread");

    await act(async () => pending[2]({ notifications: [unreadNotification] }));
    expect(await screen.findByText("Verification update")).toBeInTheDocument();
    await act(async () => {
      pending[0]({ notifications: [readNotification] });
      pending[1]({ notifications: [readNotification] });
    });
    expect(screen.getByText("Verification update")).toBeInTheDocument();
    expect(screen.queryByText("Export ready")).not.toBeInTheDocument();
  });

  it("removes a read item from the unread-only view", async () => {
    const user = userEvent.setup();
    vi.mocked(notificationsService.list).mockResolvedValue({ notifications: [{ ...unreadNotification, resourceType: null }] });
    render(<NotificationBell />);
    await user.click(await screen.findByRole("button", { name: /notifications, 1 unread/i }));
    await user.selectOptions(screen.getByRole("combobox", { name: /show/i }), "unread");
    await user.click(await screen.findByRole("button", { name: /verification update/i }));
    await waitFor(() => expect(screen.getByText("No notifications here")).toBeInTheDocument());
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
});
