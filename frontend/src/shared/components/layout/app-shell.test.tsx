import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/journal" }));
vi.mock("@/shared/components/navigation/app-topbar", () => ({
  AppTopbar: ({ showNotifications }: { showNotifications: boolean }) =>
    showNotifications ? <button type="button">Notifications</button> : null,
}));
vi.mock("@/shared/components/navigation/notification-bell", () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
}));
vi.mock("@/shared/components/ui/light-theme-tailwind-css-background-snippet", () => ({
  RadialBackground: () => null,
}));

describe("AppShell mobile navigation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the current page and notifications, then returns focus after Escape", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const user = userEvent.setup();
    render(
      <AppShell>
        <p>Journal content</p>
      </AppShell>,
    );

    expect(screen.getByText("Journal content")).toBeVisible();
    expect(
      within(screen.getByRole("button", { name: "Open navigation" }).parentElement!).getByText("Journal"),
    ).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Notifications" })).toHaveLength(1);

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "App navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Crisis Support" })).toHaveAttribute("href", "/crisis");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("keeps public access navigation free of private destinations", async () => {
    const user = userEvent.setup();
    render(
      <AppShell publicAccess>
        <p>Find help</p>
      </AppShell>,
    );
    expect(screen.queryByRole("button", { name: "Notifications" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Crisis support" })).toHaveAttribute("href", "/crisis");
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    const menu = within(screen.getByRole("dialog", { name: "App navigation" }));
    expect(menu.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(menu.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });
});
