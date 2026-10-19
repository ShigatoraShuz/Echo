import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsSidebar } from "./settings-shell";

const route = vi.hoisted(() => ({ pathname: "/settings" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

describe("SettingsSidebar", () => {
  beforeEach(() => {
    route.pathname = "/settings";
  });

  it("offers the main sections directly and keeps every other section under More", async () => {
    const user = userEvent.setup();
    render(<SettingsSidebar />);
    const mobileSections = within(screen.getByRole("navigation", { name: "Mobile settings sections" }));
    for (const label of ["Profile", "Privacy", "Notifications"]) {
      expect(mobileSections.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(mobileSections.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
    await user.click(mobileSections.getByText("More"));
    for (const label of ["Verification", "Trusted contacts", "Security", "Data & account"]) {
      expect(mobileSections.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("keeps mobile section tabs visible on a detail route", () => {
    route.pathname = "/settings/privacy";
    render(<SettingsSidebar />);
    const mobileSections = within(screen.getByRole("navigation", { name: "Mobile settings sections" }));
    expect(mobileSections.getByRole("link", { name: "Privacy" })).toHaveAttribute("aria-current", "page");
    expect(mobileSections.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/settings/profile");
  });
});
