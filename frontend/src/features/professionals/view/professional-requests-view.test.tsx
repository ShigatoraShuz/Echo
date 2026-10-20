import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/shared/errors/app-error";
import { ProfessionalMyCasesView, ProfessionalRequestsView } from "./professional-requests-view";
import MyCasesPage from "@/app/(protected)/professional/my-cases/page";
import RequestsPage from "@/app/(protected)/professional/requests/page";

const mocks = vi.hoisted(() => ({ memberships: vi.fn(), queue: vi.fn(), claim: vi.fn(), caseDetail: vi.fn(), replace: vi.fn(), refresh: vi.fn(), searchParams: new URLSearchParams(), pathname: "/professional/my-cases" }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks, useSearchParams: () => mocks.searchParams, usePathname: () => mocks.pathname }));
vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: { memberships: mocks.memberships, queue: mocks.queue, claim: mocks.claim, caseDetail: mocks.caseDetail } }));

const membership = { id: "member", organizationId: "org-one", role: "counselor", status: "active", accessState: "active", organization: { id: "org-one", name: "Organization One", status: "active" } };
const rows = [
  { id: "CASE0001-synthetic", organizationId: "org-one", status: "assigned", assignedTo: "me", createdAt: "2026-10-01T09:00:00Z", updatedAt: "2026-10-04T09:00:00Z" },
  { id: "CLOSED01-synthetic", organizationId: "org-one", status: "closed", assignedTo: "me", createdAt: "2026-10-02T09:00:00Z", updatedAt: "2026-10-05T09:00:00Z" },
  { id: "PENDING1-synthetic", organizationId: "org-one", status: "submitted", assignedTo: null, createdAt: "2026-10-03T09:00:00Z", updatedAt: "2026-10-03T09:00:00Z" },
  { id: "OTHER001-synthetic", organizationId: "org-one", status: "scheduled", assignedTo: "other", createdAt: "2026-10-04T09:00:00Z", updatedAt: "2026-10-04T09:00:00Z" },
];
beforeEach(() => {
  mocks.pathname = "/professional/my-cases";
  mocks.searchParams = new URLSearchParams("organization=org-one");
  mocks.memberships.mockResolvedValue({ userId: "me", mfaRequired: false, memberships: [membership] });
  mocks.queue.mockResolvedValue({ requests: rows });
  mocks.claim.mockResolvedValue({});
});

describe("FE-009 real request workspace", () => {
  it("uses the existing queue API without search parameters or any case-content requests", async () => {
    mocks.pathname = "/professional/requests";
    mocks.queue.mockResolvedValue({ requests: rows.map((item) => ({ ...item, summary: "Private summary", notes: [{ body: "Private note" }] })) });
    render(<ProfessionalRequestsView />);
    await screen.findByRole("heading", { name: "Request PENDING1" });
    await userEvent.type(screen.getByRole("searchbox"), "pending");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Assigned practitioner" }), "unassigned");
    expect(mocks.queue).toHaveBeenCalledExactlyOnceWith("org-one");
    expect(mocks.caseDetail).not.toHaveBeenCalled();
    expect(document.body).not.toHaveTextContent("Private summary");
    expect(document.body).not.toHaveTextContent("Private note");
    expect(screen.getByRole("button", { name: "Accept request" })).toBeInTheDocument();
    expect(mocks.claim).not.toHaveBeenCalled();
  });
});

describe("FE-012 My Cases", () => {
  it("shows only own scoped cases, including closed cases, with honest date labels and permitted links", async () => {
    mocks.queue.mockResolvedValue({ requests: [...rows, { ...rows[0], id: "FOREIGN1", organizationId: "foreign" }] });
    render(<ProfessionalMyCasesView />);
    await screen.findByRole("heading", { name: "Case CASE0001" });
    expect(screen.getByRole("heading", { name: "Case CLOSED01" })).toBeInTheDocument();
    for (const id of ["OTHER001", "PENDING1", "FOREIGN1"]) expect(document.body).not.toHaveTextContent(id);
    expect(screen.getAllByText("Assigned date unavailable in this overview.")).toHaveLength(2);
    const list = screen.getByRole("region", { name: "Assigned cases" });
    expect(within(list).getAllByRole("link", { name: "Open case" }).map((item) => item.getAttribute("href"))).toContain("/professional/cases/CASE0001-synthetic?organization=org-one");
    expect(within(list).queryByRole("combobox", { name: "Assigned practitioner" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept request" })).not.toBeInTheDocument();
    expect(screen.getByText(/Older assigned cases may be outside this view/)).toBeInTheDocument();
    expect(mocks.caseDetail).not.toHaveBeenCalled();
  });

  it("provides an empty assigned-case overview without pretending all historical cases were loaded", async () => {
    mocks.queue.mockResolvedValue({ requests: rows.filter((item) => item.assignedTo !== "me") });
    render(<ProfessionalMyCasesView />);
    expect(await screen.findByRole("heading", { name: "No assigned cases in this overview." })).toBeInTheDocument();
    expect(screen.getByText(/Older records may be outside this overview/)).toBeInTheDocument();
  });

  it("hides all case links while memberships and queue reads are unresolved", async () => {
    mocks.queue.mockReturnValue(new Promise(() => undefined));
    render(<ProfessionalMyCasesView />);
    expect(screen.queryByRole("link", { name: "Open case" })).not.toBeInTheDocument();
    expect(await screen.findByRole("status", { name: "Loading request queue" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Case CASE0001" })).not.toBeInTheDocument();
  });

  it.each([[401, "AUTHENTICATION_REQUIRED", "Sign in again"], [403, "RESOURCE_FORBIDDEN", "Access is not available"], [404, "NOT_FOUND", "This resource is unavailable"], [429, "RATE_LIMITED", "Please wait before trying again"], [503, "DATABASE_UNAVAILABLE", "Professional service temporarily unavailable"]])("handles queue failure %s / %s without exposing cases", async (status, code, title) => {
    mocks.queue.mockRejectedValue(new AppError({ code: code as AppError["code"], statusCode: Number(status), userMessage: "Private backend context" }));
    render(<ProfessionalMyCasesView />);
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("CASE0001");
    expect(document.body).not.toHaveTextContent("Private backend context");
    expect(mocks.queue).toHaveBeenCalledTimes(1);
    if (status === 401) expect(mocks.replace).toHaveBeenCalledWith("/professional/login?error=sign_in_session_expired&next=%2Fprofessional%2Fmy-cases%3Forganization%3Dorg-one");
  });

  it("keeps expired credentials outside the assigned-case data source", async () => {
    mocks.memberships.mockResolvedValue({ userId: "me", mfaRequired: false, memberships: [{ ...membership, accessState: "credential_expired" }] });
    render(<ProfessionalMyCasesView />);
    expect(await screen.findByRole("heading", { name: "Credential renewal is required" })).toBeInTheDocument();
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it("offers no clinical case actions for a nonclinical role", async () => {
    mocks.memberships.mockResolvedValue({ userId: "me", mfaRequired: false, memberships: [{ ...membership, role: "coordinator" }] });
    render(<ProfessionalMyCasesView />);
    await screen.findByRole("heading", { name: "Case CASE0001" });
    expect(screen.queryByRole("link", { name: "Open case" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Clinical case access is unavailable for your role.")).toHaveLength(2);
  });

  it("switches organization on the My Cases route, clears old rows and resets filters", async () => {
    const second = { ...membership, id: "second", organizationId: "org-two", organization: { id: "org-two", name: "Organization Two", status: "active" } };
    mocks.memberships.mockResolvedValue({ userId: "me", mfaRequired: false, memberships: [membership, second] });
    const { rerender } = render(<ProfessionalMyCasesView />);
    await screen.findByRole("heading", { name: "Case CASE0001" });
    await userEvent.type(screen.getByRole("searchbox"), "closed");
    fireEvent.change(screen.getByLabelText("Submitted from"), { target: { value: "2026-10-02" } });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Active organization" }), "org-two");
    expect(mocks.replace).toHaveBeenCalledWith("/professional/my-cases?organization=org-two", { scroll: false });
    expect(screen.queryByRole("heading", { name: "Case CLOSED01" })).not.toBeInTheDocument();
    mocks.searchParams = new URLSearchParams("organization=org-two");
    mocks.queue.mockResolvedValue({ requests: [{ ...rows[0], id: "NEWORG01", organizationId: "org-two" }] });
    rerender(<ProfessionalMyCasesView />);
    await screen.findByRole("heading", { name: "Case NEWORG01" });
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByLabelText("Submitted from")).toHaveValue("");
    expect(mocks.queue).toHaveBeenLastCalledWith("org-two");
    expect(screen.getByRole("link", { name: "Open case" })).toHaveAttribute("href", "/professional/cases/NEWORG01?organization=org-two");
  });

  it("ignores a previous organization's late My Cases response", async () => {
    let finish!: (result: unknown) => void;
    mocks.memberships.mockResolvedValue({ userId: "me", mfaRequired: false, memberships: [membership, { ...membership, organizationId: "org-two" }] });
    mocks.queue.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; })).mockResolvedValue({ requests: [{ ...rows[0], id: "NEWORG01", organizationId: "org-two" }] });
    const { rerender } = render(<ProfessionalMyCasesView />);
    await waitFor(() => expect(mocks.queue).toHaveBeenCalledWith("org-one"));
    mocks.searchParams = new URLSearchParams("organization=org-two");
    rerender(<ProfessionalMyCasesView />);
    await screen.findByRole("heading", { name: "Case NEWORG01" });
    await act(async () => finish({ requests: rows }));
    expect(screen.queryByRole("heading", { name: "Case CASE0001" })).not.toBeInTheDocument();
  });

  it("clears displayed cases when a scoped refresh loses authorization", async () => {
    render(<ProfessionalMyCasesView />);
    await screen.findByRole("heading", { name: "Case CASE0001" });
    mocks.queue.mockRejectedValue(new AppError({ code: "AUTHORIZATION_ERROR", statusCode: 403, userMessage: "Revoked" }));
    await userEvent.click(screen.getByRole("button", { name: "Refresh my cases" }));
    expect(screen.queryByRole("heading", { name: "Case CASE0001" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Access is not available" })).toBeInTheDocument();
  });

  it.each([[MyCasesPage, "/professional/my-cases"], [RequestsPage, "/professional/requests"]])("wraps real page %s in the existing MFA workspace gate", async (Page, pathname) => {
    mocks.pathname = pathname;
    mocks.memberships.mockResolvedValue({ userId: "me", mfaRequired: true, memberships: [membership] });
    render(<Page />);
    expect(await screen.findByRole("heading", { name: "Authenticator verification required" })).toBeInTheDocument();
    expect(mocks.replace).toHaveBeenCalledWith(`/professional/access?next=${encodeURIComponent(`${pathname}?organization=org-one`)}`);
    expect(mocks.queue).not.toHaveBeenCalled();
  });
});
