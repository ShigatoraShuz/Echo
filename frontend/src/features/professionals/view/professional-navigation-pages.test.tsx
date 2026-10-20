import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "jest-axe";
import CalendarPage from "@/app/(protected)/professional/calendar/page";
import ResourcesPage from "@/app/(protected)/professional/resources/page";
import { AppError } from "@/shared/errors/app-error";

const api = vi.hoisted(() => ({ memberships: vi.fn(), dashboard: vi.fn(), queue: vi.fn(), caseDetail: vi.fn(), resources: vi.fn() }));
const navigation = vi.hoisted(() => ({ pathname: "/professional/calendar", params: new URLSearchParams("organization=org-one"), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname, useSearchParams: () => navigation.params, useRouter: () => navigation }));
vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: api }));
vi.mock("@/services/experience/experience-api", () => ({ experienceApi: { getSupportResources: api.resources } }));

const membership = (id: string) => ({ id, organizationId: id, role: "counselor", status: "active", accessState: "active", organization: { name: `Fictional ${id}`, status: "active" } });
const appointment = { id: "fictional-appointment", requestId: "fe000000-0000-4000-8000-000000000001", startsAt: "2099-10-14T10:00:00Z", endsAt: "2099-10-14T11:00:00Z", mode: "online", status: "proposed" };
const summary = { organizationId: "org-one", userId: "fictional-professional", asOf: "2026-10-14T08:00:00Z", counts: { pendingCount: 0, activeCount: 1, scheduledCount: 1 }, appointments: [appointment], appointmentTotal: 1, appointmentLimit: 5, scheduledCases: [], scheduledLimit: 3, clinicalAccess: true, followUpsAvailable: false };
beforeEach(() => {
  vi.resetAllMocks();
  navigation.pathname = "/professional/calendar";
  navigation.params = new URLSearchParams("organization=org-one");
  api.memberships.mockResolvedValue({ userId: summary.userId, mfaRequired: false, memberships: [membership("org-one"), membership("org-two")] });
  api.dashboard.mockResolvedValue(summary);
  api.resources.mockResolvedValue([]);
});
afterEach(cleanup);

describe("dedicated protected professional pages", () => {
  it.each(["counselor", "psychologist", "social_worker"])("shows the authorized %s schedule with scoped case links", async (role) => {
    api.memberships.mockResolvedValue({ userId: summary.userId, memberships: [{ ...membership("org-one"), role }] });
    const { container } = render(<CalendarPage />);
    await screen.findByRole("link", { name: "Open case FE000000" });
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open case FE000000" })).toHaveAttribute("href", `/professional/cases/${appointment.requestId}?organization=org-one`);
    expect(api.dashboard).toHaveBeenCalledWith("org-one");
    expect(api.queue).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Today, at a glance" })).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each(["org_admin", "coordinator"])("gives %s an informational Organization Calendar without fetching clinical records", async (role) => {
    api.memberships.mockResolvedValue({ userId: summary.userId, memberships: [{ ...membership("org-one"), role }] });
    // A schedule request would return private fixture records. It must not run.
    api.dashboard.mockResolvedValue(summary);
    const { container } = render(<CalendarPage />);
    await screen.findByRole("heading", { name: "Organization Calendar" });
    expect(screen.getByText("Organization-wide scheduling is not available yet")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("No upcoming appointments")).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing .* upcoming/)).not.toBeInTheDocument();
    expect(screen.queryByText("Clinical appointment details are unavailable for your role.")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Open case|Open My cases/ })).not.toBeInTheDocument();
    expect(container.querySelector("time")).toBeNull();
    expect(api.dashboard).not.toHaveBeenCalled();
    expect(api.queue).not.toHaveBeenCalled();
    expect(api.caseDetail).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "View organization requests" })).toHaveAttribute("href", "/professional/requests?organization=org-one");
    await userEvent.click(screen.getByRole("button", { name: "Refresh access" }));
    await screen.findByRole("heading", { name: "Organization Calendar" });
    expect(api.dashboard).not.toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("does not turn an expected administrator restriction into a failed schedule request", async () => {
    api.memberships.mockResolvedValue({ userId: summary.userId, memberships: [{ ...membership("org-one"), role: "org_admin" }] });
    api.dashboard.mockRejectedValue(new AppError({ code: "UNKNOWN_ERROR", statusCode: 503, userMessage: "Private diagnostics" }));
    render(<CalendarPage />);
    await screen.findByRole("heading", { name: "Organization Calendar" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(api.dashboard).not.toHaveBeenCalled();
  });

  it("honors the backend clinicalAccess denial for a clinical membership", async () => {
    api.dashboard.mockResolvedValue({ ...summary, clinicalAccess: false, appointments: [], appointmentTotal: 0 });
    render(<CalendarPage />);
    await screen.findByRole("heading", { name: "Organization Calendar" });
    expect(screen.queryByRole("link", { name: /^Open case / })).not.toBeInTheDocument();
    expect(screen.queryByText("No upcoming appointments")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["pending_membership", "credential_expired", "suspended_organization"])("does not grant an administrator with %s calendar access", async (accessState) => {
    api.memberships.mockResolvedValue({ userId: summary.userId, memberships: [{ ...membership("org-one"), role: "org_admin", accessState }] });
    render(<CalendarPage />);
    await screen.findByRole("alert");
    expect(screen.queryByRole("heading", { name: "Organization Calendar" })).not.toBeInTheDocument();
    expect(api.dashboard).not.toHaveBeenCalled();
    expect(api.caseDetail).not.toHaveBeenCalled();
  });

  it("shows the real empty state only after an empty schedule response", async () => {
    api.dashboard.mockResolvedValue({ ...summary, appointments: [], appointmentTotal: 0 });
    render(<CalendarPage />);
    await screen.findByText("No upcoming appointments");
    expect(screen.queryByRole("link", { name: /^Open case / })).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 0 of 0/)).toBeInTheDocument();
  });

  it("does not label a failed schedule as an empty calendar", async () => {
    api.dashboard.mockRejectedValue(new AppError({ code: "UNKNOWN_ERROR", statusCode: 503, userMessage: "Private backend details" }));
    render(<CalendarPage />);
    await screen.findByRole("alert");
    expect(screen.queryByText("No upcoming appointments")).not.toBeInTheDocument();
    expect(screen.queryByText(/Private backend/)).not.toBeInTheDocument();
  });

  it.each([{ organizationId: "org-two" }, { userId: "another-professional" }])("conceals mismatched schedule scope %j", async (scope) => {
    api.dashboard.mockResolvedValue({ ...summary, ...scope });
    render(<CalendarPage />);
    await screen.findByRole("alert");
    expect(screen.queryByRole("link", { name: /^Open case / })).not.toBeInTheDocument();
  });

  it.each([401, 403])("clears appointments when refresh loses access (%s)", async (statusCode) => {
    render(<CalendarPage />);
    await screen.findByRole("link", { name: /^Open case / });
    api.dashboard.mockRejectedValue(new AppError({ code: "UNKNOWN_ERROR", statusCode, userMessage: "Private diagnostic" }));
    await userEvent.click(screen.getByRole("button", { name: "Refresh schedule" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("link", { name: /^Open case / })).not.toBeInTheDocument();
  });

  it("switches within Calendar and ignores a late previous-organization schedule", async () => {
    let resolve!: (value: typeof summary) => void;
    api.dashboard.mockReturnValueOnce(new Promise((done) => { resolve = done; })).mockResolvedValue({ ...summary, organizationId: "org-two", appointments: [], appointmentTotal: 0 });
    const { rerender } = render(<CalendarPage />);
    await waitFor(() => expect(api.dashboard).toHaveBeenCalledWith("org-one"));
    await userEvent.selectOptions(screen.getByLabelText("Active organization"), "org-two");
    expect(navigation.replace).toHaveBeenCalledWith("/professional/calendar?organization=org-two", { scroll: false });
    navigation.params = new URLSearchParams("organization=org-two");
    rerender(<CalendarPage />);
    await screen.findByText("No upcoming appointments");
    await act(async () => resolve(summary));
    expect(screen.queryByRole("link", { name: /^Open case / })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Active organization")).toHaveValue("org-two");
  });

  it("clears a clinical schedule when switching to an administrator membership and rejects late clinical data", async () => {
    let resolve!: (value: typeof summary) => void;
    api.memberships.mockResolvedValue({ userId: summary.userId, memberships: [membership("org-one"), { ...membership("org-two"), role: "org_admin" }] });
    api.dashboard.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const { rerender } = render(<CalendarPage />);
    await waitFor(() => expect(api.dashboard).toHaveBeenCalledWith("org-one"));
    await userEvent.selectOptions(screen.getByLabelText("Active organization"), "org-two");
    navigation.params = new URLSearchParams("organization=org-two");
    rerender(<CalendarPage />);
    await screen.findByRole("heading", { name: "Organization Calendar" });
    await act(async () => resolve(summary));
    expect(api.dashboard).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: /^Open case / })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Organization Calendar" })).toBeInTheDocument();
    expect(screen.getByLabelText("Active organization")).toHaveValue("org-two");
  });

  it("registers professional Resources without rendering or linking the User Side directory", async () => {
    navigation.pathname = "/professional/resources";
    const { container } = render(<ResourcesPage />);
    await screen.findByText(/No reviewed crisis resources/);
    expect(screen.getByRole("heading", { name: "Professional resources" })).toBeInTheDocument();
    expect(api.resources).toHaveBeenCalledWith({ country: "PH", type: "crisis_hotline" });
    expect(api.queue).not.toHaveBeenCalled();
    expect(api.dashboard).not.toHaveBeenCalled();
    expect(container.querySelector('a[href="/support/find-help"]')).toBeNull();
    const nav = screen.getByRole("navigation", { name: "Professional workspace" });
    expect(within(nav).getByRole("link", { name: "Resources" })).toHaveAttribute("aria-current", "page");
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each(["calendar", "resources"])("keeps %s behind MFA and preserves its return route", async (route) => {
    navigation.pathname = `/professional/${route}`;
    api.memberships.mockResolvedValue({ userId: summary.userId, mfaRequired: true, memberships: [membership("org-one")] });
    render(route === "calendar" ? <CalendarPage /> : <ResourcesPage />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(`/professional/access?next=${encodeURIComponent(`/professional/${route}?organization=org-one`)}`));
    expect(api.dashboard).not.toHaveBeenCalled();
    expect(api.resources).not.toHaveBeenCalled();
  });

  it.each(["calendar", "resources"])("denies suspended membership before loading %s", async (route) => {
    navigation.pathname = `/professional/${route}`;
    api.memberships.mockResolvedValue({ userId: summary.userId, memberships: [{ ...membership("org-one"), accessState: "suspended_membership" }] });
    render(route === "calendar" ? <CalendarPage /> : <ResourcesPage />);
    await screen.findByRole("alert");
    expect(api.dashboard).not.toHaveBeenCalled();
    expect(api.resources).not.toHaveBeenCalled();
  });
});
