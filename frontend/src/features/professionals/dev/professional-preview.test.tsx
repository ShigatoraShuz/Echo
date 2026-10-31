import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "jest-axe";
import { ProfessionalPreview } from "./professional-preview";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(), logout: vi.fn(), replace: vi.fn(), refresh: vi.fn(),
  memberships: vi.fn(), queue: vi.fn(), claim: vi.fn(), caseDetail: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dev/professional-preview",
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/services/authentication/auth-service.factory", () => ({ getAuthService: () => ({ logout: mocks.logout }) }));
vi.mock("@/services/professionals/professional-api", () => ({
  professionalApi: { memberships: mocks.memberships, queue: mocks.queue, claim: mocks.claim, caseDetail: mocks.caseDetail },
}));

beforeEach(() => {
  window.history.replaceState(null, "", "/dev/professional-preview");
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("synthetic professional workspace", () => {
  it("keeps request management, assignment dates and claim confirmation synthetic and inert", async () => {
    render(<ProfessionalPreview />);
    await userEvent.click(screen.getByText("Inspect request management"));
    const inspector = screen.getByRole("region", { name: "Synthetic request management" });
    expect(within(inspector).getByRole("button", { name: "Accept request" })).toBeDisabled();
    await userEvent.click(within(inspector).getByRole("button", { name: "Preview My Cases" }));
    expect(within(inspector).getByRole("heading", { name: "Case QA000002" })).toBeVisible();
    expect(within(inspector).queryByText("QA000003")).not.toBeInTheDocument();
    expect(within(inspector).getAllByText(/Assigned .*Synthetic/)).toHaveLength(2);
    expect(within(inspector).getAllByRole("button", { name: "Open synthetic case" }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    await userEvent.click(within(inspector).getByRole("button", { name: "Inspect claim confirmation" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Synthetic preview only");
    expect(screen.getByRole("button", { name: "Confirm acceptance" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    for (const call of [mocks.fetch, mocks.memberships, mocks.queue, mocks.claim, mocks.caseDetail, mocks.replace]) expect(call).not.toHaveBeenCalled();
  });

  it("resets synthetic request filters and confirmation when preview organization changes", async () => {
    render(<ProfessionalPreview />);
    await userEvent.click(screen.getByText("Inspect request management"));
    const inspector = screen.getByRole("region", { name: "Synthetic request management" });
    await userEvent.type(within(inspector).getByRole("searchbox"), "no-result");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Active organization" }), "preview-org-1");
    await userEvent.click(screen.getByText("Inspect request management"));
    const nextInspector = screen.getByRole("region", { name: "Synthetic request management" });
    expect(within(nextInspector).getByRole("searchbox")).toHaveValue("");
    expect(within(nextInspector).getByRole("heading", { name: "Request QB000001" })).toBeVisible();
    expect(within(nextInspector).queryByText("QA000001")).not.toBeInTheDocument();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("labels appointment dates and task rows as synthetic with disabled completion and no live calls", () => {
    render(<ProfessionalPreview />);
    const appointments = screen.getByRole("region", { name: "Upcoming appointments" });
    expect(appointments).toHaveTextContent("Synthetic schedule only");
    expect(within(appointments).getByText("14 Oct 2026, 14:00")).toBeVisible();
    const tasks = screen.getByRole("region", { name: "Professional follow-ups" });
    expect(tasks).toHaveTextContent("Synthetic tasks for visual QA");
    for (const button of within(tasks).getAllByRole("button", { name: "Complete synthetic task" })) {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.caseDetail).not.toHaveBeenCalled();
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("scopes synthetic appointments and follow-ups to the chosen organization and resets the active-case filter", async () => {
    render(<ProfessionalPreview />);
    await userEvent.click(screen.getByRole("button", { name: "My active cases" }));
    expect(screen.queryByText("Request DEMO0001")).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Active organization" }), "preview-org-1");
    expect(screen.getByRole("button", { name: "My active cases" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Request ALT00001")).toBeVisible();
    const appointments = screen.getByRole("region", { name: "Upcoming appointments" });
    expect(appointments).toHaveTextContent("15 Oct 2026, 10:00");
    expect(appointments).not.toHaveTextContent("14 Oct 2026, 14:00");
    const tasks = screen.getByRole("region", { name: "Professional follow-ups" });
    expect(tasks).toHaveTextContent("Case ALT00002");
    expect(tasks).toHaveTextContent("Case ALT00003");
    expect(tasks).not.toHaveTextContent("DEMO");
    expect(mocks.memberships).not.toHaveBeenCalled();
    expect(mocks.queue).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("selects synthetic access failures with inert recovery controls and no live calls", async () => {
    render(<ProfessionalPreview />);
    const selector = screen.getByRole("combobox", { name: "Preview access state" });
    await userEvent.selectOptions(selector, "mfa");
    expect(screen.getByRole("heading", { name: "Authenticator verification required" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Complete authenticator verification" })).toBeDisabled();
    await userEvent.selectOptions(selector, "network");
    expect(screen.getByRole("heading", { name: "Connection interrupted" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.memberships).not.toHaveBeenCalled();
  });
  it("switches organization cards locally while disabled memberships cannot alter the preview", async () => {
    render(<ProfessionalPreview />);
    await userEvent.click(screen.getByText("Inspect synthetic organization choices"));
    expect(screen.getByRole("button", { name: /Preview Organization Awaiting Approval/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /Preview Community Organization With a Long Name/ }));
    expect(screen.getByRole("combobox", { name: "Active organization" })).toHaveValue("preview-org-1");
    expect(screen.getByText("Request ALT00001")).toBeVisible();
    expect(screen.queryByText("Request DEMO0001")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Preview Community Organization With a Long Name/ })).toHaveAttribute("aria-pressed", "true");
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.memberships).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("keeps the overview and sample case semantically accessible", async () => {
    const { container } = render(<ProfessionalPreview />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    // jsdom has no rendered theme CSS; contrast remains a real-browser QA check.
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });

  it("uses the existing shell with preview-only navigation and inert mutation controls", () => {
    render(<ProfessionalPreview />);
    expect(screen.getByText(/Local development preview/)).toBeVisible();
    for (const name of ["Professional workspace", "Professional mobile navigation"]) {
      const nav = screen.getByRole("navigation", { name });
      expect(within(nav).getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
    }
    for (const anchor of screen.getAllByRole("link")) {
      expect(anchor.getAttribute("href")).toMatch(/^(#|\/dev\/professional-preview(?:#|$))/);
    }
    for (const name of ["Sign out", "Accept request", "Cancel appointment"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("keeps organization selection and queue filtering entirely in memory", async () => {
    render(<ProfessionalPreview />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Active organization" }), "preview-org-1");
    expect(screen.getByText(/Showing synthetic requests for Preview Community Organization/)).toBeVisible();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status" }), "closed");
    expect(screen.getByText("No requests match this view.")).toBeVisible();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status" }), "scheduled");
    expect(screen.getByText("Request ALT00003")).toBeVisible();
    expect(screen.queryByText("Request DEMO0001")).not.toBeInTheDocument();
    expect(mocks.fetch).not.toHaveBeenCalled();
    for (const method of [mocks.memberships, mocks.queue, mocks.claim, mocks.caseDetail]) expect(method).not.toHaveBeenCalled();
  });
});
