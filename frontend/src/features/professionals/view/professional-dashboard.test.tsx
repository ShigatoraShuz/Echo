import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfessionalDashboard } from "./professional-dashboard";
import { AppError } from "@/shared/errors/app-error";
import { axe } from "jest-axe";

const mocks = vi.hoisted(() => ({
  memberships: vi.fn(), queue: vi.fn(), claim: vi.fn(), dashboard: vi.fn(),
  replace: vi.fn(), refresh: vi.fn(), searchParams: new URLSearchParams(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/professional", useSearchParams: () => mocks.searchParams,
  useRouter: () => mocks,
}));
vi.mock("@/services/professionals/professional-api", () => ({
  professionalApi: { memberships: mocks.memberships, queue: mocks.queue, claim: mocks.claim, dashboard: mocks.dashboard },
}));

const membership = { id: "demo-membership", organizationId: "demo-org", role: "counselor", status: "active", accessState: "active", organization: { name: "Demo organization", status: "active" } };
const requests = [
  { id: "NEW00001-demo", status: "submitted", assignedTo: null },
  { id: "CASE0002-demo", status: "assigned", assignedTo: "demo-professional" },
  { id: "CASE0003-demo", status: "scheduled", assignedTo: "demo-professional" },
  { id: "OTHER004-demo", status: "assigned", assignedTo: "demo-other-professional" },
].map((item) => ({ ...item, organizationId: "demo-org", createdAt: "2026-10-12T01:00:00.000Z", updatedAt: "2026-10-12T01:00:00.000Z" }));

beforeEach(() => {
  mocks.searchParams = new URLSearchParams();
  mocks.memberships.mockResolvedValue({ userId: "demo-professional", memberships: [membership] });
  mocks.queue.mockResolvedValue({ requests });
  mocks.claim.mockResolvedValue({});
});
afterEach(cleanup);

describe("professional dashboard presentation", () => {
  const metricValue = (label: string) => screen.getByText(label, { selector: "dt span" }).closest("dt")?.parentElement?.querySelector("dd > div")?.textContent;

  const summary = {
    organizationId: "demo-org", userId: "demo-professional", asOf: "2026-10-14T08:00:00Z",
    counts: { pendingCount: 205, activeCount: 12, scheduledCount: 4 }, scheduledCases: [requests[2]], scheduledLimit: 3,
    appointments: [{ id: "synthetic-appointment", requestId: requests[2].id, startsAt: "2099-10-14T10:00:00Z", endsAt: "2099-10-14T11:00:00Z", mode: "online", status: "proposed" }],
    appointmentTotal: 6, appointmentLimit: 5, clinicalAccess: true, followUpsAvailable: false,
  };
  const queuePage = { requests, page: { total: 250, offset: 0, limit: 100, hasMore: true } };
  it("uses exact backend totals and a bounded appointment list when aggregation is available", async () => {
    mocks.queue.mockResolvedValue(queuePage); mocks.dashboard.mockResolvedValue(summary);
    render(<ProfessionalDashboard />);
    await screen.findByText(/Counts cover all pending requests/);
    expect(metricValue("Pending requests")).toBe("205"); expect(metricValue("My active cases")).toBe("12");
    expect(await screen.findByText(/Showing 1 of 6 upcoming/)).toBeInTheDocument();
    expect(mocks.dashboard).toHaveBeenCalledWith("demo-org");
    expect(screen.getByRole("link", { name: "Open My cases" })).toHaveAttribute("href", "/professional/my-cases?organization=demo-org");
  });
  it("labels limited counts when the aggregation migration/service is unavailable", async () => {
    mocks.queue.mockResolvedValue(queuePage); mocks.dashboard.mockRejectedValue(new AppError({ code: "SERVER_ERROR", statusCode: 503, userMessage: "Synthetic private database message" }));
    render(<ProfessionalDashboard />);
    await screen.findByText(/Organization-wide totals are temporarily unavailable/);
    expect(metricValue("Pending requests")).toBe("1"); expect(screen.queryByText(/private database message/)).not.toBeInTheDocument();
  });
  it.each([401, 403, 404])("clears loaded metadata when aggregation returns %s", async (statusCode) => {
    mocks.queue.mockResolvedValue(queuePage); mocks.dashboard.mockRejectedValue(new AppError({ code: "UNKNOWN_ERROR", statusCode, userMessage: "Synthetic private diagnostic" }));
    render(<ProfessionalDashboard />); await screen.findByRole("alert");
    expect(screen.queryByRole("heading", { name: "Request NEW00001" })).not.toBeInTheDocument();
    expect(screen.queryByText("Pending requests", { selector: "dt span" })).not.toBeInTheDocument();
  });
  it("rejects an aggregation payload from another organization or actor", async () => {
    mocks.queue.mockResolvedValue(queuePage); mocks.dashboard.mockResolvedValue({ ...summary, organizationId: "other-org" });
    render(<ProfessionalDashboard />); await screen.findByRole("alert");
    expect(screen.queryByRole("heading", { name: "Request NEW00001" })).not.toBeInTheDocument();
  });
  it("ignores a late aggregate response after organization navigation", async () => {
    let resolve!: (value: typeof summary) => void;
    mocks.queue.mockResolvedValue(queuePage); mocks.dashboard.mockReturnValueOnce(new Promise((yes) => { resolve = yes; })).mockResolvedValue({ ...summary, counts: { pendingCount: 7, activeCount: 2, scheduledCount: 0 }, scheduledCases: [], appointments: [] });
    const { rerender } = render(<ProfessionalDashboard />);
    await waitFor(() => expect(mocks.dashboard).toHaveBeenCalledTimes(1));
    mocks.searchParams = new URLSearchParams("organization=demo-org&refresh=1"); rerender(<ProfessionalDashboard />);
    await screen.findByText(/Counts cover all pending requests/);
    expect(metricValue("Pending requests")).toBe("7");
    await act(async () => resolve(summary)); expect(metricValue("Pending requests")).toBe("7");
  });

  it("requires explicit confirmation and supports cancellation with focus restoration", async () => {
    render(<ProfessionalDashboard />);
    const button = await screen.findByRole("button", { name: "Accept request" });
    await userEvent.click(button);
    expect(screen.getByRole("dialog", { name: "Accept this request?" })).toHaveTextContent("NEW00001-demo");
    expect(mocks.claim).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("blocks duplicate confirmations and allows closing while the confirmed action remains pending", async () => {
    let finish!: () => void;
    mocks.claim.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    render(<ProfessionalDashboard />);
    await userEvent.click(await screen.findByRole("button", { name: "Accept request" }));
    const confirm = screen.getByRole("button", { name: "Confirm acceptance" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(mocks.claim).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Confirming acceptance" })).toBeDisabled();
    expect(screen.queryByText("Request accepted. Your overview is up to date.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("button", { name: "Accepting" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Active organization" })).toBeDisabled();
    await act(async () => finish());
    expect(await screen.findByText("Request accepted. Your overview is up to date.")).toBeInTheDocument();
  });

  it("handles the current REQUEST_ALREADY_ASSIGNED conflict without disclosing details or replaying a mutation", async () => {
    mocks.claim.mockRejectedValue(new AppError({ code: "REQUEST_ALREADY_ASSIGNED" as AppError["code"], statusCode: 409, userMessage: "Private actor ID" }));
    render(<ProfessionalDashboard />);
    await userEvent.click(await screen.findByRole("button", { name: "Accept request" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm acceptance" }));
    expect(await screen.findByRole("heading", { name: "Request already accepted or changed" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).not.toHaveTextContent("Private actor ID");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    mocks.queue.mockResolvedValue({ requests: requests.map((item) => item.id === requests[0].id ? { ...item, status: "assigned", assignedTo: "other" } : item) });
    await userEvent.click(screen.getByRole("button", { name: "Retry workspace" }));
    expect(await screen.findByRole("heading", { name: "Request NEW00001" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept request" })).not.toBeInTheDocument();
    expect(mocks.claim).toHaveBeenCalledTimes(1);
  });

  it("resolves an uncertain network outcome by reading current assignment before another mutation", async () => {
    mocks.claim.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ProfessionalDashboard />);
    await userEvent.click(await screen.findByRole("button", { name: "Accept request" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm acceptance" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Acceptance could not be confirmed");
    mocks.queue.mockResolvedValue({ requests: requests.map((item) => item.id === requests[0].id ? { ...item, status: "assigned", assignedTo: "demo-professional" } : item) });
    await userEvent.click(screen.getByRole("button", { name: "Retry workspace" }));
    await screen.findByRole("heading", { name: "Request NEW00001" });
    expect(screen.queryByRole("button", { name: "Accept request" })).not.toBeInTheDocument();
    expect(mocks.claim).toHaveBeenCalledTimes(1);
    expect(metricValue("My active cases")).toBe("3");
  });

  it("uses scoped status counts that stay accurate while filtering and exclude ended cases", async () => {
    mocks.queue.mockResolvedValue({ requests: [...requests,
      { ...requests[1], id: "CLOSED01-demo", status: "closed" },
      { ...requests[1], id: "DECLINE1-demo", status: "declined" },
      { ...requests[0], id: "FOREIGN1-demo", organizationId: "other-org" },
    ] });
    render(<ProfessionalDashboard />);
    await screen.findByRole("heading", { name: "Request NEW00001" });
    expect(metricValue("Pending requests")).toBe("1");
    expect(metricValue("My active cases")).toBe("2");
    expect(metricValue("Scheduled cases")).toBe("1");
    expect(screen.queryByRole("heading", { name: "Request FOREIGN1" })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status" }), "closed");
    expect(metricValue("My active cases")).toBe("2");
    await userEvent.click(screen.getByRole("button", { name: "My active cases" }));
    expect(screen.getByRole("button", { name: "My active cases" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Request CASE0002" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Request CASE0003" })).toBeInTheDocument();
    for (const id of ["CLOSED01", "DECLINE1", "NEW00001", "OTHER004"]) expect(screen.queryByRole("heading", { name: `Request ${id}` })).not.toBeInTheDocument();
  });

  it("shows older pending work first and keeps the overview to five rows until expanded", async () => {
    const extra = Array.from({ length: 4 }, (_, index) => ({ ...requests[0], id: `OLDER00${index}-demo`, createdAt: `2026-10-0${index + 1}T09:00:00Z` }));
    mocks.queue.mockResolvedValue({ requests: [...requests, ...extra] });
    render(<ProfessionalDashboard />);
    const queue = await screen.findByRole("region", { name: "Request queue" });
    await within(queue).findByRole("heading", { name: "Request OLDER000" });
    expect(within(queue).getAllByRole("heading", { level: 3 }).map((item) => item.textContent)).toEqual(["Request OLDER000", "Request OLDER001", "Request OLDER002", "Request OLDER003", "Request NEW00001"]);
    await userEvent.click(within(queue).getByRole("button", { name: "Show all 8 matching requests" }));
    expect(within(queue).getAllByRole("heading", { level: 3 })).toHaveLength(8);
    expect(within(queue).getByRole("button", { name: "Show fewer requests" })).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(within(queue).getByRole("button", { name: "Show fewer requests" }));
    expect(within(queue).getAllByRole("heading", { level: 3 })).toHaveLength(5);
  });

  it("labels the API's capped overview instead of claiming organization-wide totals", async () => {
    mocks.queue.mockResolvedValue({ requests: Array.from({ length: 100 }, (_, index) => ({ ...requests[0], id: `PENDING-${index}` })) });
    render(<ProfessionalDashboard />);
    expect(await screen.findByText(/latest 100 requests; older cases/)).toBeInTheDocument();
    expect(metricValue("Pending requests")).toBe("100");
    expect(screen.getByText("Showing 5 of 100 matching requests.")).toBeInTheDocument();
  });

  it("renders a genuine empty overview and explains unavailable task/schedule data", async () => {
    mocks.queue.mockResolvedValue({ requests: [] });
    render(<ProfessionalDashboard />);
    expect(await screen.findByRole("heading", { name: "No requests in this organization yet." })).toBeInTheDocument();
    for (const name of ["Pending requests", "My active cases", "Scheduled cases"]) expect(metricValue(name)).toBe("0");
    expect(screen.getByText(/A task list is not available here yet/)).toBeInTheDocument();
    expect(screen.getByText(/A combined schedule is not available here yet/)).toBeInTheDocument();
    expect(screen.queryByText("Review agreed next steps")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Upcoming appointments" })).not.toBeInTheDocument();
  });

  it("refreshes membership before replacing the overview and hides old records if approval is lost", async () => {
    let finish!: (result: unknown) => void;
    mocks.memberships.mockResolvedValueOnce({ userId: "demo-professional", memberships: [membership] }).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<ProfessionalDashboard />);
    await screen.findByRole("heading", { name: "Request NEW00001" });
    await userEvent.click(screen.getByRole("button", { name: "Refresh overview" }));
    expect(screen.queryByRole("heading", { name: "Request NEW00001" })).not.toBeInTheDocument();
    expect(screen.queryByText("Pending requests", { selector: "dt span" })).not.toBeInTheDocument();
    await act(async () => finish({ userId: "demo-professional", memberships: [{ ...membership, status: "suspended", accessState: "suspended_membership" }] }));
    expect(screen.getByRole("heading", { name: "Professional access is suspended" })).toBeInTheDocument();
    expect(mocks.queue).toHaveBeenCalledTimes(1);
  });

  it("confirms acceptance only after its real queue refresh succeeds", async () => {
    mocks.queue.mockResolvedValueOnce({ requests }).mockResolvedValue({ requests: requests.map((item) => item.id === requests[0].id ? { ...item, status: "assigned", assignedTo: "demo-professional" } : item) });
    render(<ProfessionalDashboard />);
    await userEvent.click(await screen.findByRole("button", { name: "Accept request" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm acceptance" }));
    expect(await screen.findByText("Request accepted. Your overview is up to date.")).toHaveAttribute("role", "status");
    expect(metricValue("Pending requests")).toBe("0");
    expect(metricValue("My active cases")).toBe("3");
  });

  it("does not report successful synchronization after a failed post-claim refresh", async () => {
    mocks.queue.mockResolvedValueOnce({ requests }).mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ProfessionalDashboard />);
    await userEvent.click(await screen.findByRole("button", { name: "Accept request" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm acceptance" }));
    expect(await screen.findByRole("heading", { name: "Connection interrupted" })).toBeInTheDocument();
    expect(screen.queryByText("Request accepted. Your overview is up to date.")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Case CASE0003/ })).not.toBeInTheDocument();
  });

  it("keeps the scheduled-case summary compact and opens the complete scoped view with keyboard focus", async () => {
    mocks.queue.mockResolvedValue({ requests: Array.from({ length: 6 }, (_, index) => ({ ...requests[2], id: `SCHED00${index}-demo` })) });
    render(<ProfessionalDashboard />);
    const calendar = await screen.findByRole("region", { name: "Scheduled cases" });
    await within(calendar).findByRole("link", { name: /Case SCHED000/ });
    expect(within(calendar).getAllByRole("link")).toHaveLength(3);
    const queue = screen.getByRole("region", { name: "Request queue" });
    queue.scrollIntoView = vi.fn();
    await userEvent.click(within(calendar).getByRole("button", { name: "View all 6 scheduled cases in the queue" }));
    expect(within(queue).getByRole("combobox", { name: "Status" })).toHaveFocus();
    expect(within(queue).getAllByRole("heading", { level: 3 })).toHaveLength(6);
    expect(metricValue("Scheduled cases")).toBe("6");
  });

  it("keeps dashboard regions, toggles and status controls semantically accessible", async () => {
    const { container } = render(<ProfessionalDashboard />);
    await screen.findByRole("heading", { name: "Request NEW00001" });
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });
  it.each([[401, "AUTHENTICATION_REQUIRED"], [403, "RESOURCE_FORBIDDEN"], [403, "MFA_REQUIRED"], [404, "NOT_FOUND"]])("removes queue data after a claim returns %s / %s", async (status, code) => {
    mocks.claim.mockRejectedValue(new AppError({ code: code as AppError["code"], statusCode: Number(status), userMessage: "Private diagnostic" }));
    render(<ProfessionalDashboard />);
    await userEvent.click(await screen.findByRole("button", { name: "Accept request" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm acceptance" }));
    expect(screen.queryByRole("heading", { name: "Request CASE0002" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept request" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).not.toHaveTextContent("Private diagnostic");
    expect(mocks.queue).toHaveBeenCalledTimes(1);
    if (status === 401) expect(mocks.replace).toHaveBeenCalledWith("/professional/login?error=sign_in_session_expired&next=%2Fprofessional");
    if (code === "MFA_REQUIRED") expect(mocks.replace).toHaveBeenCalledWith("/professional/access?next=%2Fprofessional");
  });

  it("recovers queue loading from a network failure without replaying a mutation", async () => {
    mocks.queue.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue({ requests });
    render(<ProfessionalDashboard />);
    expect(await screen.findByRole("heading", { name: "Connection interrupted" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept request" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry workspace" }));
    expect(await screen.findByRole("heading", { name: "Request NEW00001" })).toBeInTheDocument();
    expect(mocks.queue).toHaveBeenCalledTimes(2);
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it("switches through the URL, clears scoped state and reloads only the approved target", async () => {
    const second = { ...membership, id: "second-member", organizationId: "second-org", organization: { name: "Second organization", status: "active" } };
    mocks.memberships.mockResolvedValue({ userId: "demo-professional", memberships: [membership, second] });
    const { rerender } = render(<ProfessionalDashboard />);
    await screen.findByRole("heading", { name: "Request NEW00001" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status" }), "scheduled");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Active organization" }), "second-org");
    expect(mocks.replace).toHaveBeenCalledWith("/professional?organization=second-org", { scroll: false });
    expect(screen.queryByRole("heading", { name: "Request CASE0003" })).not.toBeInTheDocument();
    // Model the query update from Next navigation, preserving the component instance.
    mocks.searchParams = new URLSearchParams("organization=second-org");
    mocks.queue.mockResolvedValue({ requests: [{ ...requests[0], id: "SECOND01-demo", organizationId: "second-org" }] });
    rerender(<ProfessionalDashboard />);
    await screen.findByRole("heading", { name: "Request SECOND01" });
    expect(mocks.queue).toHaveBeenLastCalledWith("second-org");
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("all");
    expect(screen.getByRole("combobox", { name: "Active organization" })).toHaveValue("second-org");
    expect(screen.queryByRole("heading", { name: "Request NEW00001" })).not.toBeInTheDocument();
  });

  it("ignores late queue responses from the previous organization", async () => {
    let finishOld!: (result: { requests: typeof requests }) => void;
    const second = { ...membership, id: "second-member", organizationId: "second-org" };
    mocks.memberships.mockResolvedValue({ userId: "demo-professional", memberships: [membership, second] });
    mocks.queue.mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; })).mockResolvedValue({ requests: [] });
    const { rerender } = render(<ProfessionalDashboard />);
    await waitFor(() => expect(mocks.queue).toHaveBeenCalledWith("demo-org"));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Active organization" }), "second-org");
    mocks.searchParams = new URLSearchParams("organization=second-org");
    rerender(<ProfessionalDashboard />);
    await waitFor(() => expect(mocks.queue).toHaveBeenLastCalledWith("second-org"));
    await act(async () => finishOld({ requests }));
    expect(screen.queryByRole("heading", { name: "Request NEW00001" })).not.toBeInTheDocument();
  });

  it("does not let an old claim completion refresh a different organization's queue", async () => {
    let finishOldClaim!: () => void;
    mocks.claim.mockReturnValue(new Promise<void>((resolve) => { finishOldClaim = resolve; }));
    mocks.memberships.mockResolvedValue({ userId: "demo-professional", memberships: [membership, { ...membership, id: "second-member", organizationId: "second-org" }] });
    const { rerender } = render(<ProfessionalDashboard />);
    await userEvent.click(await screen.findByRole("button", { name: "Accept request" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm acceptance" }));
    expect(screen.getByRole("combobox", { name: "Active organization" })).toBeDisabled();
    // Browser history/query navigation can still occur during an action.
    mocks.searchParams = new URLSearchParams("organization=second-org");
    mocks.queue.mockResolvedValue({ requests: [] });
    rerender(<ProfessionalDashboard />);
    await waitFor(() => expect(mocks.queue).toHaveBeenLastCalledWith("second-org"));
    const calls = mocks.queue.mock.calls.length;
    await act(async () => finishOldClaim());
    expect(mocks.queue).toHaveBeenCalledTimes(calls);
    expect(screen.queryByRole("heading", { name: "Request NEW00001" })).not.toBeInTheDocument();
  });

  it("never fetches an unauthorized organization from the URL", async () => {
    mocks.searchParams = new URLSearchParams("organization=unapproved-org");
    mocks.memberships.mockResolvedValue({ userId: "demo-professional", memberships: [membership, { ...membership, id: "denied", organizationId: "unapproved-org", accessState: "suspended_membership" }] });
    render(<ProfessionalDashboard />);
    await screen.findByRole("heading", { name: "Request NEW00001" });
    expect(screen.getByText(/That organization is unavailable/)).toBeInTheDocument();
    expect(mocks.queue).not.toHaveBeenCalledWith("unapproved-org");
    expect(screen.getByRole("combobox", { name: "Active organization" })).toHaveValue("demo-org");
  });

  it("keeps queues inaccessible when no organization is available or MFA is required", async () => {
    mocks.memberships.mockResolvedValue({ userId: "demo-professional", mfaRequired: true, memberships: [membership] });
    const { rerender } = render(<ProfessionalDashboard />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/professional/access?next=%2Fprofessional"));
    expect(mocks.queue).not.toHaveBeenCalled();
    mocks.searchParams = new URLSearchParams("organization=revoked");
    mocks.memberships.mockResolvedValue({ userId: "demo-professional", mfaRequired: false, memberships: [{ ...membership, accessState: "credential_expired" }] });
    rerender(<ProfessionalDashboard />);
    expect(await screen.findByRole("heading", { name: "Credential renewal is required" })).toBeInTheDocument();
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it("retries a membership load error without retaining earlier scoped information", async () => {
    mocks.memberships.mockRejectedValueOnce(new Error("Synthetic membership failure"));
    render(<ProfessionalDashboard />);
    await screen.findByRole("alert");
    expect(mocks.queue).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Retry workspace" }));
    await screen.findByRole("heading", { name: "Request NEW00001" });
    expect(mocks.memberships).toHaveBeenCalledTimes(2);
  });

  it("shows a target queue error without old data and supports retry", async () => {
    mocks.queue.mockRejectedValueOnce(new Error("Synthetic queue failure"));
    render(<ProfessionalDashboard />);
    await screen.findByRole("alert");
    expect(screen.queryByRole("heading", { name: "Request NEW00001" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry workspace" }));
    await screen.findByRole("heading", { name: "Request NEW00001" });
    expect(mocks.queue).toHaveBeenLastCalledWith("demo-org");
  });

  it("keeps requests and scheduled cases in labeled regions with the existing case links", async () => {
    render(<ProfessionalDashboard />);
    const queue = await screen.findByRole("region", { name: "Request queue" });
    await within(queue).findByRole("heading", { name: "Request NEW00001" });
    expect(within(queue).getByText("Assigned elsewhere")).toBeVisible();
    const calendar = screen.getByRole("region", { name: "Scheduled cases" });
    expect(within(calendar).getByRole("link", { name: /Case CASE0003/ })).toHaveAttribute("href", "/professional/cases/CASE0003-demo?organization=demo-org");
    expect(screen.getByRole("combobox", { name: "Active organization" })).toHaveValue("demo-org");
  });

  it("retains status filtering and the queue empty state", async () => {
    render(<ProfessionalDashboard />);
    const queue = await screen.findByRole("region", { name: "Request queue" });
    await within(queue).findByRole("heading", { name: "Request NEW00001" });
    await userEvent.selectOptions(within(queue).getByRole("combobox", { name: "Status" }), "scheduled");
    expect(within(queue).getByRole("heading", { name: "Request CASE0003" })).toBeVisible();
    expect(within(queue).queryByRole("heading", { name: "Request NEW00001" })).not.toBeInTheDocument();
    await userEvent.selectOptions(within(queue).getByRole("combobox", { name: "Status" }), "closed");
    expect(within(queue).getByRole("heading", { name: "No requests match this view." })).toBeVisible();
  });

  it("preserves claim handling, its pending state, and queue refresh", async () => {
    let finishClaim!: () => void;
    mocks.claim.mockReturnValue(new Promise<void>((resolve) => { finishClaim = resolve; }));
    render(<ProfessionalDashboard />);
    await userEvent.click(await screen.findByRole("button", { name: "Accept request" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm acceptance" }));
    expect(mocks.claim).toHaveBeenCalledWith("NEW00001-demo");
    expect(screen.getByRole("button", { name: "Accepting" })).toBeDisabled();
    await act(async () => { finishClaim(); });
    await waitFor(() => expect(mocks.queue).toHaveBeenCalledTimes(2));
    expect(mocks.queue).toHaveBeenLastCalledWith("demo-org");
  });

  it("does not show a claim action for roles without the existing claim permission", async () => {
    mocks.memberships.mockResolvedValue({ userId: "demo-professional", memberships: [{ ...membership, role: "org_admin" }] });
    render(<ProfessionalDashboard />);
    await screen.findByRole("heading", { name: "Request NEW00001" });
    expect(screen.queryByRole("button", { name: "Accept request" })).not.toBeInTheDocument();
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("shows queue loading without repeating the page heading or displaying zero counts", async () => {
    mocks.queue.mockReturnValue(new Promise(() => {}));
    render(<ProfessionalDashboard />);
    expect(await screen.findByRole("status", { name: "Loading request queue" })).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Loading pending requests")).toBeInTheDocument();
  });
});
