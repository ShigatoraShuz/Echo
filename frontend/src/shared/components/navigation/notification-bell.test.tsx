import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "./notification-bell";
import { notificationsService } from "@/services/notifications";

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
  });

  it("marks one notification read when clicked", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    await user.click(await screen.findByRole("button", { name: /notifications, 1 unread/i }));
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
});
