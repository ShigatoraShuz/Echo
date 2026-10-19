import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppTopbar } from "./app-topbar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/support/find-help",
}));

vi.mock("./notification-bell", () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

vi.mock("./app-profile-menu", () => ({
  AppProfileMenu: () => <div data-testid="profile-menu" />,
}));

describe("AppTopbar", () => {
  it("can omit the desktop bell when the phone bell is mounted", () => {
    render(<AppTopbar showNotifications={false} />);

    expect(screen.queryByTestId("notification-bell")).not.toBeInTheDocument();
    expect(screen.getByTestId("profile-menu")).toBeInTheDocument();
  });

  it("uses public actions without mounting authenticated controls", () => {
    render(<AppTopbar publicAccess />);

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Start privately" })).toHaveAttribute("href", "/signup");
    expect(screen.queryByTestId("notification-bell")).not.toBeInTheDocument();
    expect(screen.queryByTestId("profile-menu")).not.toBeInTheDocument();
  });
});
