import type { AnchorHTMLAttributes } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfessionalShell } from "./professional-shell";

const mocks = vi.hoisted(() => ({
  pathname: "/professional",
  replace: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/services/authentication/auth-service.factory", () => ({
  getAuthService: () => ({ logout: mocks.logout }),
}));
vi.mock("next/link", () => ({
  default: ({ href, onNavigate, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    onNavigate?: () => void;
  }) => (
    <a {...props} href={href} onClick={(event) => {
      event.preventDefault();
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      onNavigate?.();
      // Match Next's same-page navigation: pushState does not emit hashchange.
      window.history.pushState(null, "", href);
    }}>{children}</a>
  ),
}));

function expectCurrent(label: string, value: "page" | "location") {
  for (const name of ["Professional workspace", "Professional mobile navigation"]) {
    const nav = screen.getByRole("navigation", { name });
    expect(within(nav).getByRole("link", { name: label })).toHaveAttribute("aria-current", value);
    expect(nav.querySelectorAll("[aria-current]")).toHaveLength(1);
  }
}

beforeEach(() => {
  mocks.pathname = "/professional";
  window.history.replaceState(null, "", "/professional");
  mocks.logout.mockResolvedValue({ success: true });
});
afterEach(cleanup);

describe("ProfessionalShell", () => {
  it("retains organization scope in every dedicated workspace link", async () => {
    const { rerender } = render(<ProfessionalShell organizationId="o2">Content</ProfessionalShell>);
    const nav = screen.getByRole("navigation", { name: "Professional workspace" });
    expect(within(nav).getByRole("link", { name: "Today" })).toHaveAttribute("href", "/professional?organization=o2");
    expect(within(nav).getByRole("link", { name: "Requests" })).toHaveAttribute("href", "/professional/requests?organization=o2");
    expect(within(nav).getByRole("link", { name: "My cases" })).toHaveAttribute("href", "/professional/my-cases?organization=o2");
    expect(within(nav).getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "/professional/calendar?organization=o2");
    expect(within(nav).getByRole("link", { name: "Resources" })).toHaveAttribute("href", "/professional/resources?organization=o2");
    await userEvent.click(within(nav).getByRole("link", { name: "Calendar" }));
    mocks.pathname = "/professional/calendar";
    rerender(<ProfessionalShell organizationId="o2">Calendar</ProfessionalShell>);
    expectCurrent("Calendar", "page");
    expect(window.location.search).toBe("?organization=o2");
  });

  it("marks the dedicated My Cases route active on desktop and mobile", () => {
    mocks.pathname = "/professional/my-cases";
    window.history.replaceState(null, "", "/professional/my-cases?organization=o2");
    render(<ProfessionalShell organizationId="o2">Cases</ProfessionalShell>);
    expectCurrent("My cases", "page");
  });

  it("shares hash-aware active navigation and preserves the workspace landmarks", async () => {
    window.history.replaceState(null, "", "/professional?organization=o1#requests");
    const { rerender } = render(<ProfessionalShell><h1>Workspace content</h1></ProfessionalShell>);
    expectCurrent("Requests", "location");
    expect(screen.getByRole("main")).toHaveAttribute("id", "professional-content");
    expect(screen.getByRole("link", { name: "Skip to workspace content" })).toHaveAttribute("href", "#professional-content");

    const mobile = screen.getByRole("navigation", { name: "Professional mobile navigation" });
    await userEvent.click(within(mobile).getByRole("link", { name: "Calendar" }));
    mocks.pathname = "/professional/calendar";
    rerender(<ProfessionalShell>Calendar</ProfessionalShell>);
    expectCurrent("Calendar", "page");
    await userEvent.click(within(mobile).getByRole("link", { name: "Today" }));
    mocks.pathname = "/professional";
    rerender(<ProfessionalShell>Today</ProfessionalShell>);
    expectCurrent("Today", "page");
  });

  it("updates both navigation states for native hash changes and browser history", () => {
    render(<ProfessionalShell>Content</ProfessionalShell>);
    expectCurrent("Today", "page");
    act(() => {
      window.history.replaceState(null, "", "/professional#professional-content");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expectCurrent("Today", "page");
    act(() => {
      window.history.replaceState(null, "", "/professional#requests");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expectCurrent("Requests", "location");
  });

  it("does not select hash destinations on another path or on modified clicks", () => {
    mocks.pathname = "/professional/cases/case-1";
    window.history.replaceState(null, "", `${mocks.pathname}#requests`);
    const { rerender } = render(<ProfessionalShell>Case</ProfessionalShell>);
    expect(document.querySelectorAll("nav [aria-current]")).toHaveLength(0);
    mocks.pathname = "/professional";
    window.history.replaceState(null, "", "/professional");
    rerender(<ProfessionalShell>Today</ProfessionalShell>);
    expectCurrent("Today", "page");
    fireEvent.click(within(screen.getByRole("navigation", { name: "Professional workspace" })).getByRole("link", { name: "Requests" }), { ctrlKey: true });
    expectCurrent("Today", "page");
    mocks.pathname = "/professional/resources";
    window.history.replaceState(null, "", mocks.pathname);
    rerender(<ProfessionalShell>Resources</ProfessionalShell>);
    expect(within(screen.getByRole("navigation", { name: "Professional workspace" })).getByRole("link", { name: "Resources" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("navigation", { name: "Professional mobile navigation" }).querySelector("[aria-current]")).toBeNull();
  });

  it("preserves hash-based navigation for the isolated preview", async () => {
    mocks.pathname = "/dev/professional-preview";
    window.history.replaceState(null, "", mocks.pathname);
    const icon = () => null;
    const navigationItems = [{ label: "Today", href: mocks.pathname, icon }, { label: "Calendar", href: `${mocks.pathname}#calendar`, icon }] as unknown as NonNullable<Parameters<typeof ProfessionalShell>[0]["navigationItems"]>;
    render(<ProfessionalShell navigationItems={navigationItems}>Preview</ProfessionalShell>);
    await userEvent.click(within(screen.getByRole("navigation", { name: "Professional workspace" })).getByRole("link", { name: "Calendar" }));
    expectCurrent("Calendar", "location");
  });

  it("offers four bottom destinations and a keyboard-dismissible menu with scoped Resources", async () => {
    render(<ProfessionalShell organizationId="o1">Content</ProfessionalShell>);
    const bottom = screen.getByRole("navigation", { name: "Professional mobile navigation" });
    expect(within(bottom).getAllByRole("link").map((link) => link.textContent)).toEqual(["Today", "Requests", "My cases", "Calendar"]);
    const trigger = screen.getByRole("button", { name: "Open workspace menu" });
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("dialog", { name: "Your workspace" });
    expect(within(menu).getByRole("link", { name: "Resources" })).toHaveAttribute("href", "/professional/resources?organization=o1");
    expect(within(menu).getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Resources" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/professional/resources");
  });

  it("offers only active organizations and forwards the selected organization", async () => {
    const onChange = vi.fn();
    const memberships = [
      { id: "m1", organizationId: "o1", status: "active", role: "counselor", accessState: "active", organization: { name: "School One", status: "active" } },
      { id: "m2", organizationId: "o2", status: "active", role: "coordinator", accessState: "active", organization: { name: "School Two", status: "active" } },
      { id: "m3", organizationId: "o3", status: "pending", role: "counselor", accessState: "pending_membership", organization: { name: "Pending School", status: "active" } },
    ] as NonNullable<Parameters<typeof ProfessionalShell>[0]["memberships"]>;
    render(<ProfessionalShell memberships={memberships} organizationId="o1" onOrganizationChange={onChange}>Content</ProfessionalShell>);
    const select = screen.getByRole("combobox", { name: "Active organization" });
    expect(within(select).getAllByRole("option")).toHaveLength(2);
    await userEvent.selectOptions(select, "o2");
    expect(onChange).toHaveBeenCalledWith("o2");
  });

  it("keeps logout pending until completion and preserves the login redirect", async () => {
    let resolveLogout!: (result: { success: boolean }) => void;
    mocks.logout.mockReturnValue(new Promise((resolve) => { resolveLogout = resolve; }));
    render(<ProfessionalShell>Content</ProfessionalShell>);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByRole("button", { name: "Signing out" })).toBeDisabled();
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    await act(async () => { resolveLogout({ success: true }); });
    expect(mocks.replace).toHaveBeenCalledWith("/professional/login");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("allows retry after logout fails without redirecting", async () => {
    mocks.logout.mockResolvedValueOnce({ success: false, error: { message: "Failed" } });
    render(<ProfessionalShell>Content</ProfessionalShell>);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Could not sign out. Please try again.");
    expect(mocks.replace).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/professional/login"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("blocks same-frame duplicate logout events before React commits pending state", async () => {
    let resolve!: (value: { success: boolean }) => void;
    mocks.logout.mockReturnValue(new Promise((yes) => { resolve = yes; }));
    render(<ProfessionalShell>Content</ProfessionalShell>);
    const button = screen.getByRole("button", { name: "Sign out" });
    act(() => { button.click(); button.click(); });
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ success: true }));
  });
});
