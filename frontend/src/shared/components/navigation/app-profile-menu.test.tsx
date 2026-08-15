import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppProfileMenu } from "./app-profile-menu";

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    className,
  }: {
    alt: string;
    className?: string;
  }) => <div role="img" aria-label={alt} className={className} />,
}));

vi.mock("@/features/authentication/services/auth-service.factory", () => ({
  getAuthService: () => ({
    logout: mocks.logout,
  }),
}));

vi.mock("@/features/settings/services/settings.service", () => ({
  settingsService: {
    get: mocks.getSettings,
  },
}));

describe("AppProfileMenu", () => {
  beforeEach(() => {
    mocks.getSettings.mockResolvedValue({
      profile: { displayName: "Mira" },
    });
    mocks.logout.mockResolvedValue({ success: true, data: undefined });
  });

  it("exposes working destinations for every account action", async () => {
    const user = userEvent.setup();
    render(<AppProfileMenu />);

    await user.click(screen.getByRole("button", { name: "Profile menu for Mira" }));

    expect(screen.getByRole("menu", { name: "Account" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute(
      "href",
      "/settings/profile#profile-overview",
    );
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("menuitem", { name: "Account verification" })).toHaveAttribute(
      "href",
      "/settings/verification",
    );
    expect(screen.getByRole("menuitem", { name: "Profile settings" })).toHaveAttribute(
      "href",
      "/settings/profile#personal-details",
    );
    expect(screen.getByRole("menuitem", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/settings/privacy",
    );
    expect(screen.getByRole("menuitem", { name: "Notifications" })).toHaveAttribute(
      "href",
      "/settings/notifications",
    );
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeEnabled();
  });

  it("supports menu keyboard navigation and restores trigger focus on Escape", async () => {
    const user = userEvent.setup();
    render(<AppProfileMenu />);
    const trigger = screen.getByRole("button", { name: "Profile menu for Mira" });

    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveFocus();

    await user.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Log out" })).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("menu", { name: "Account" })).not.toBeInTheDocument();
  });

  it("closes when focus moves through a selected link", async () => {
    const user = userEvent.setup();
    render(<AppProfileMenu />);

    await user.click(screen.getByRole("button", { name: "Profile menu for Mira" }));
    const privacyLink = screen.getByRole("menuitem", { name: "Privacy" });
    privacyLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(privacyLink);

    expect(screen.queryByRole("menu", { name: "Account" })).not.toBeInTheDocument();
  });

  it("logs out through the auth service before redirecting to login", async () => {
    const user = userEvent.setup();
    let finishLogout: ((value: { success: true; data: undefined }) => void) | undefined;
    mocks.logout.mockReturnValue(
      new Promise((resolve) => {
        finishLogout = resolve;
      }),
    );
    render(<AppProfileMenu />);

    await user.click(screen.getByRole("button", { name: "Profile menu for Mira" }));
    await user.click(screen.getByRole("menuitem", { name: "Log out" }));
    expect(screen.getByRole("menuitem", { name: "Logging out…" })).toBeDisabled();

    finishLogout?.({ success: true, data: undefined });

    await waitFor(() => {
      expect(mocks.logout).toHaveBeenCalledTimes(1);
      expect(mocks.replace).toHaveBeenCalledWith("/login");
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps the menu open and explains a logout failure", async () => {
    const user = userEvent.setup();
    mocks.logout.mockResolvedValue({
      success: false,
      error: { code: "UNKNOWN", message: "Sign out is temporarily unavailable." },
    });
    render(<AppProfileMenu />);

    await user.click(screen.getByRole("button", { name: "Profile menu for Mira" }));
    await user.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sign out is temporarily unavailable.");
    expect(screen.getByRole("menu", { name: "Account" })).toBeVisible();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
