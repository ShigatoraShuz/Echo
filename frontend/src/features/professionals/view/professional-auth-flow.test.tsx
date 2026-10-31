import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfessionalWorkspaceGate } from "../components/professional-workspace-gate";
import { ProfessionalAccessView } from "./professional-access-view";
import { ProfessionalLoginView } from "./professional-login-view";
import { ProfessionalCaseView } from "./professional-case-view";
import { AppError } from "@/shared/errors/app-error";

const mocks = vi.hoisted(() => ({
  memberships: vi.fn(),
  prepareMfa: vi.fn(),
  verifyMfa: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  searchParams: new URLSearchParams(),
  pathname: "/professional",
  getCurrentSession: vi.fn(),
  caseDetail: vi.fn(),
  caseMessages: vi.fn(),
  markCaseMessagesRead: vi.fn(),
  close: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => mocks,
  useSearchParams: () => mocks.searchParams,
  usePathname: () => mocks.pathname,
}));
vi.mock("@/services/professionals/professional-api", () => ({
  professionalApi: {
    memberships: mocks.memberships,
    caseDetail: mocks.caseDetail,
    caseMessages: mocks.caseMessages,
    markCaseMessagesRead: mocks.markCaseMessagesRead,
    close: mocks.close,
  },
}));
vi.mock("@/services/authentication/reviewer-mfa", () => ({
  prepareReviewerMfa: mocks.prepareMfa,
  verifyReviewerMfa: mocks.verifyMfa,
}));
vi.mock("@/services/authentication/auth-service.factory", () => ({
  getAuthService: () => ({ getCurrentSession: mocks.getCurrentSession }),
}));
vi.mock("../components/professional-shell", () => ({
  ProfessionalShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  ProfessionalSkeleton: () => <p>Loading professional access</p>,
  RequestStatus: ({ status }: { status: string }) => <span>{status}</span>,
}));

const membership = {
  id: "m1", organizationId: "o1", organization: { id: "o1", name: "School One", status: "active" },
  role: "counselor", status: "active", displayName: "Alex", credentialLabel: "Licensed",
  credentialExpiresAt: "2099-12-31", accessState: "active",
};
const caseId = "fe000000-0000-4000-8000-000000000001";
const caseData = {
  request: { id: caseId, status: "assigned", sharingActive: true, preferredTime: "", summary: "Synthetic private case summary" },
  sharedJournals: [], appointments: [], referrals: [], notes: [], viewer: "professional",
};
const apiFailure = (statusCode: number, code = "RESOURCE_FORBIDDEN") => new AppError({
  code: code as AppError["code"], statusCode, userMessage: "Private backend diagnostic",
});
function deferred<T>() {
  let resolve!: (result: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParams = new URLSearchParams();
  mocks.pathname = "/professional";
  mocks.getCurrentSession.mockResolvedValue({ success: true, data: null });
  mocks.caseMessages.mockResolvedValue({ messages: [], nextCursor: null });
  mocks.markCaseMessagesRead.mockResolvedValue({ read: true });
});

describe("professional auth flow", () => {
  it("returns to My Cases after choosing among approved organizations", async () => {
    mocks.searchParams = new URLSearchParams({ next: "/professional/my-cases?organization=old" });
    mocks.memberships.mockResolvedValue({ userId: "u1", mfaRequired: false, memberships: [membership, { ...membership, id: "m2", organizationId: "o2", organization: { ...membership.organization, id: "o2", name: "School Two" } }] });
    render(<ProfessionalAccessView />);
    await userEvent.click(await screen.findByRole("button", { name: /School Two/ }));
    expect(mocks.replace).toHaveBeenCalledWith("/professional/my-cases?organization=o2");
  });

  it("keeps approved case organization context in the shell and request-queue return link", async () => {
    mocks.searchParams = new URLSearchParams("organization=wrong-context");
    mocks.caseDetail.mockResolvedValue({ ...caseData, request: { ...caseData.request, organizationId: "approved-case-org" } });
    render(<ProfessionalCaseView id={caseId} />);
    await screen.findByText(caseData.request.summary);
    expect(screen.getByRole("link", { name: "Request queue" })).toHaveAttribute("href", "/professional/requests?organization=approved-case-org");
  });
  it("redirects a signed-out deep link safely without mounting protected content", async () => {
    mocks.pathname = `/professional/cases/${caseId}`;
    mocks.searchParams = new URLSearchParams("organization=synthetic");
    mocks.memberships.mockRejectedValue(apiFailure(401, "AUTHENTICATION_REQUIRED"));
    render(<ProfessionalWorkspaceGate><p>Private case data</p></ProfessionalWorkspaceGate>);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(`/professional/login?error=sign_in_session_expired&next=${encodeURIComponent(`${mocks.pathname}?organization=synthetic`)}`));
    expect(screen.queryByText("Private case data")).not.toBeInTheDocument();
    expect(mocks.memberships).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["pending_membership", "Professional approval is pending"],
    ["suspended_membership", "Professional access is suspended"],
    ["suspended_organization", "Professional access is suspended"],
    ["credential_expired", "Credential renewal is required"],
  ])("keeps %s out of protected content", async (accessState, title) => {
    mocks.memberships.mockResolvedValue({ mfaRequired: false, memberships: [{ ...membership, accessState }] });
    render(<ProfessionalWorkspaceGate><p>Private case data</p></ProfessionalWorkspaceGate>);
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.queryByText("Private case data")).not.toBeInTheDocument();
    expect(mocks.replace).toHaveBeenCalledWith("/professional/access?next=%2Fprofessional");
  });

  it.each([
    [403, "RESOURCE_FORBIDDEN", "Access is not available"],
    [403, "MFA_REQUIRED", "Authenticator verification required"],
    [404, "NOT_FOUND", "This resource is unavailable"],
    [429, "RATE_LIMITED", "Please wait before trying again"],
    [503, "DATABASE_UNAVAILABLE", "Professional service temporarily unavailable"],
  ])("presents %s / %s without protected content or repeated checks", async (status, code, title) => {
    mocks.memberships.mockRejectedValue(apiFailure(Number(status), code));
    render(<ProfessionalWorkspaceGate><p>Private case data</p></ProfessionalWorkspaceGate>);
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.queryByText("Private case data")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).not.toHaveTextContent("Private backend diagnostic");
    expect(mocks.memberships).toHaveBeenCalledTimes(1);
    if (code === "MFA_REQUIRED") expect(mocks.replace).toHaveBeenCalledWith("/professional/access?next=%2Fprofessional");
    else expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("recovers from a network failure only after the next membership check succeeds", async () => {
    const pending = deferred<{ memberships: typeof membership[]; mfaRequired: boolean }>();
    mocks.memberships.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockReturnValue(pending.promise);
    render(<ProfessionalWorkspaceGate><p>Private case data</p></ProfessionalWorkspaceGate>);
    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(screen.queryByText("Private case data")).not.toBeInTheDocument();
    await act(async () => pending.resolve({ memberships: [membership], mfaRequired: false }));
    expect(screen.getByText("Private case data")).toBeInTheDocument();
    expect(mocks.memberships).toHaveBeenCalledTimes(2);
  });

  it("hides the previous ready workspace immediately on organization navigation", async () => {
    const pending = deferred<unknown>();
    mocks.memberships.mockResolvedValueOnce({ memberships: [membership], mfaRequired: false }).mockReturnValue(pending.promise);
    const { rerender } = render(<ProfessionalWorkspaceGate><p>Private old workspace</p></ProfessionalWorkspaceGate>);
    await screen.findByText("Private old workspace");
    mocks.searchParams = new URLSearchParams("organization=other");
    rerender(<ProfessionalWorkspaceGate><p>Private next workspace</p></ProfessionalWorkspaceGate>);
    expect(screen.queryByText(/Private .* workspace/)).not.toBeInTheDocument();
    await act(async () => pending.reject(apiFailure(403)));
    expect(screen.queryByText("Private next workspace")).not.toBeInTheDocument();
  });

  it("ignores an earlier navigation's successful access response", async () => {
    const pending = deferred<unknown>();
    mocks.memberships.mockReturnValueOnce(pending.promise).mockRejectedValue(apiFailure(403));
    const { rerender } = render(<ProfessionalWorkspaceGate><p>Private case data</p></ProfessionalWorkspaceGate>);
    mocks.searchParams = new URLSearchParams("organization=other");
    rerender(<ProfessionalWorkspaceGate><p>Private next workspace</p></ProfessionalWorkspaceGate>);
    await screen.findByRole("heading", { name: "Access is not available" });
    await act(async () => pending.resolve({ memberships: [membership], mfaRequired: false }));
    expect(screen.queryByText("Private next workspace")).not.toBeInTheDocument();
  });

  it("recovers access-request failures without a gateway self-link or automatic retry loop", async () => {
    mocks.memberships.mockRejectedValueOnce(apiFailure(503, "DATABASE_UNAVAILABLE")).mockResolvedValue({ memberships: [], mfaRequired: false });
    render(<ProfessionalAccessView />);
    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Access is not active yet")).toBeInTheDocument();
    expect(mocks.memberships).toHaveBeenCalledTimes(2);
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Check professional access" })).not.toBeInTheDocument();
  });

  it("redirects access-page session expiry to sign-in with its safe return destination", async () => {
    mocks.searchParams = new URLSearchParams({ next: `/professional/cases/${caseId}` });
    mocks.memberships.mockRejectedValue(apiFailure(401));
    render(<ProfessionalAccessView />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(`/professional/login?error=sign_in_session_expired&next=${encodeURIComponent(`/professional/cases/${caseId}`)}`));
    expect(screen.queryByRole("heading", { name: "Choose an organization" })).not.toBeInTheDocument();
  });

  it("shows actionable authenticator preparation failure without granting access", async () => {
    mocks.memberships.mockResolvedValue({ mfaRequired: true, memberships: [membership] });
    mocks.prepareMfa.mockRejectedValue(new Error("Private provider failure"));
    render(<ProfessionalAccessView />);
    expect(await screen.findByRole("heading", { name: "Authenticator verification is unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review account security" })).toHaveAttribute("href", "/settings/security");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Choose an organization" })).not.toBeInTheDocument();
  });

  it("keeps the authenticator form available after an invalid code, without retrying membership", async () => {
    mocks.memberships.mockResolvedValue({ mfaRequired: true, memberships: [membership] });
    mocks.prepareMfa.mockResolvedValue({ id: "synthetic-factor" });
    mocks.verifyMfa.mockRejectedValue(new Error("Invalid code"));
    render(<ProfessionalAccessView />);
    await userEvent.type(await screen.findByLabelText("Authenticator code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify and continue" }));
    expect(await screen.findByRole("heading", { name: "Authenticator code not verified" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify and continue" })).toBeEnabled();
    expect(mocks.memberships).toHaveBeenCalledTimes(1);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("blocks duplicate MFA submits in the same frame until verification settles", async () => {
    const pending = deferred<void>();
    mocks.memberships.mockResolvedValue({ mfaRequired: true, memberships: [membership] });
    mocks.prepareMfa.mockResolvedValue({ id: "synthetic-factor" });
    mocks.verifyMfa.mockReturnValue(pending.promise);
    render(<ProfessionalAccessView />);
    await userEvent.type(await screen.findByLabelText("Authenticator code"), "123456");
    const form = screen.getByLabelText("Authenticator code").closest("form")!;
    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(mocks.verifyMfa).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Verifying" })).toBeDisabled();
    await act(async () => pending.reject(new Error("Synthetic rejection")));
    expect(await screen.findByRole("button", { name: "Verify and continue" })).toBeEnabled();
  });

  it.each([true, false])("checks current approval again after successful MFA (approved=%s)", async (approved) => {
    mocks.memberships.mockResolvedValueOnce({ mfaRequired: true, memberships: [membership] }).mockResolvedValue({
      mfaRequired: false, memberships: [{ ...membership, accessState: approved ? "active" : "suspended_membership" }],
    });
    mocks.prepareMfa.mockResolvedValue({ id: "synthetic-factor" });
    mocks.verifyMfa.mockResolvedValue(undefined);
    render(<ProfessionalAccessView />);
    await userEvent.type(await screen.findByLabelText("Authenticator code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify and continue" }));
    expect(mocks.verifyMfa).toHaveBeenCalledWith("synthetic-factor", "123456");
    if (approved) await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/professional?organization=o1"));
    else {
      expect(await screen.findByText("Professional access suspended")).toBeInTheDocument();
      expect(mocks.replace).not.toHaveBeenCalled();
    }
    expect(mocks.memberships).toHaveBeenCalledTimes(2);
  });

  it("clears previous case data on case navigation and ignores late responses", async () => {
    const old = deferred<unknown>();
    mocks.caseDetail.mockReturnValueOnce(old.promise).mockResolvedValue({ ...caseData, request: { ...caseData.request, id: "fe000000-0000-4000-8000-000000000002", summary: "Synthetic next case" } });
    const { rerender } = render(<ProfessionalCaseView id={caseId} />);
    rerender(<ProfessionalCaseView id="fe000000-0000-4000-8000-000000000002" />);
    await screen.findByText("Synthetic next case");
    await act(async () => old.resolve(caseData));
    expect(screen.queryByText(caseData.request.summary)).not.toBeInTheDocument();
    expect(screen.getByText("Synthetic next case")).toBeInTheDocument();
  });

  it("hides an already displayed case while the next case loads", async () => {
    mocks.caseDetail.mockResolvedValueOnce(caseData).mockReturnValue(new Promise(() => undefined));
    const { rerender } = render(<ProfessionalCaseView id={caseId} />);
    await screen.findByText(caseData.request.summary);
    rerender(<ProfessionalCaseView id="fe000000-0000-4000-8000-000000000002" />);
    expect(screen.queryByText(caseData.request.summary)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close case" })).not.toBeInTheDocument();
  });

  it.each([[401, "AUTHENTICATION_REQUIRED"], [403, "MFA_REQUIRED"], [403, "RESOURCE_FORBIDDEN"], [404, "NOT_FOUND"]])("conceals a displayed case when an action returns %s / %s", async (status, code) => {
    mocks.caseDetail.mockResolvedValue(caseData);
    mocks.close.mockRejectedValue(apiFailure(Number(status), code));
    render(<ProfessionalCaseView id={caseId} />);
    await userEvent.click(await screen.findByRole("button", { name: "Close case" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm closure" }));
    expect(screen.queryByText(caseData.request.summary)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close case" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).not.toHaveTextContent("Private backend diagnostic");
    expect(mocks.caseDetail).toHaveBeenCalledTimes(1);
    if (status === 401) expect(mocks.replace).toHaveBeenCalledWith(`/professional/login?error=sign_in_session_expired&next=${encodeURIComponent(`/professional/cases/${caseId}`)}`);
    if (code === "MFA_REQUIRED") expect(mocks.replace).toHaveBeenCalledWith(`/professional/access?next=${encodeURIComponent(`/professional/cases/${caseId}`)}`);
  });

  it("does not refresh a departed case after an old action completes", async () => {
    const pending = deferred<unknown>();
    mocks.caseDetail.mockResolvedValue(caseData);
    mocks.close.mockReturnValue(pending.promise);
    const { rerender } = render(<ProfessionalCaseView id={caseId} />);
    await userEvent.click(await screen.findByRole("button", { name: "Close case" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm closure" }));
    rerender(<ProfessionalCaseView id="fe000000-0000-4000-8000-000000000002" />);
    await waitFor(() => expect(mocks.caseDetail).toHaveBeenCalledTimes(2));
    await act(async () => pending.resolve({}));
    expect(mocks.caseDetail).toHaveBeenCalledTimes(2);
  });

  it("requires a fresh case read after a closure state rejection", async () => {
    mocks.caseDetail.mockResolvedValue(caseData);
    mocks.close.mockRejectedValue(new AppError({ code: "VALIDATION_ERROR", statusCode: 400, userMessage: "Cancel the active appointment before closing." }));
    render(<ProfessionalCaseView id={caseId} />);
    await userEvent.click(await screen.findByRole("button", { name: "Close case" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm closure" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Reload its status and appointments");
    expect(screen.queryByText(caseData.request.summary)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it("discards an earlier access-page response after its return destination changes", async () => {
    const pending = deferred<unknown>();
    mocks.memberships.mockReturnValueOnce(pending.promise).mockResolvedValue({ memberships: [], mfaRequired: false });
    const { rerender } = render(<ProfessionalAccessView />);
    mocks.searchParams = new URLSearchParams({ next: `/professional/cases/${caseId}` });
    rerender(<ProfessionalAccessView />);
    await screen.findByText("Access is not active yet");
    await act(async () => pending.resolve({ memberships: [membership], mfaRequired: false }));
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByText("Access is not active yet")).toBeInTheDocument();
  });
  it("enters the sole approved organization only after the API confirms MFA", async () => {
    mocks.memberships.mockResolvedValue({ userId: "u1", mfaRequired: false, memberships: [membership] });
    render(<ProfessionalAccessView />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/professional?organization=o1"));
    expect(mocks.prepareMfa).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Choose an organization" })).not.toBeInTheDocument();
  });

  it("disables unavailable choices alongside multiple approved organizations", async () => {
    mocks.memberships.mockResolvedValue({ userId: "u1", mfaRequired: false, memberships: [
      membership,
      { ...membership, id: "m2", organizationId: "o2", organization: { ...membership.organization, id: "o2", name: "School Two" } },
      { ...membership, id: "m3", organizationId: "o3", accessState: "credential_expired", organization: { ...membership.organization, id: "o3", name: "Expired School" } },
    ] });
    render(<ProfessionalAccessView />);
    expect(await screen.findByRole("button", { name: /Expired School/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /School Two/ }));
    expect(mocks.replace).toHaveBeenCalledWith("/professional?organization=o2");
  });

  it("uses refreshed membership approval after an already-verified MFA session", async () => {
    mocks.memberships.mockResolvedValueOnce({ userId: "u1", mfaRequired: true, memberships: [membership] })
      .mockResolvedValue({ userId: "u1", mfaRequired: false, memberships: [{ ...membership, accessState: "suspended_membership", status: "suspended" }] });
    mocks.prepareMfa.mockResolvedValue(null);
    render(<ProfessionalAccessView />);
    expect(await screen.findByText("Professional access suspended")).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("sends an existing session through access while limiting the return path", async () => {
    mocks.searchParams = new URLSearchParams("next=%2Fprofessional%2Frequest");
    mocks.getCurrentSession.mockResolvedValue({ success: true, data: { isMockSession: false } });
    render(<ProfessionalLoginView />);
    expect(screen.queryByRole("link", { name: /Move your account to email/i })).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/professional/access?next=%2Fprofessional"));
  });

  it("does not mount workspace content for an ordinary signed-in user", async () => {
    mocks.memberships.mockResolvedValue({ userId: "u1", mfaRequired: true, memberships: [] });
    render(<ProfessionalWorkspaceGate><p>Private case data</p></ProfessionalWorkspaceGate>);
    expect(screen.queryByText("Private case data")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/professional/access?next=%2Fprofessional"));
  });

  it("opens workspace content only with active access and AAL2", async () => {
    mocks.memberships.mockResolvedValue({ userId: "u1", mfaRequired: false, memberships: [membership] });
    render(<ProfessionalWorkspaceGate><p>Private case data</p></ProfessionalWorkspaceGate>);
    expect(await screen.findByText("Private case data")).toBeInTheDocument();
  });

  it("shows pending approval without starting MFA", async () => {
    mocks.memberships.mockResolvedValue({ userId: "u1", mfaRequired: true, memberships: [{ ...membership, accessState: "pending_membership" }] });
    render(<ProfessionalAccessView />);
    expect(await screen.findByText("Access is not active yet")).toBeInTheDocument();
    expect(screen.getByText("Professional approval pending")).toBeInTheDocument();
    expect(mocks.prepareMfa).not.toHaveBeenCalled();
  });

  it("prompts approved AAL1 professionals for their authenticator", async () => {
    mocks.memberships.mockResolvedValue({ userId: "u1", mfaRequired: true, memberships: [membership] });
    mocks.prepareMfa.mockResolvedValue({ id: "factor1" });
    render(<ProfessionalAccessView />);
    expect(await screen.findByRole("heading", { name: "Verify your authenticator" })).toBeInTheDocument();
    expect(mocks.prepareMfa).toHaveBeenCalledWith("ECHO professional");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("lets an AAL2 professional choose among approved organizations", async () => {
    mocks.memberships.mockResolvedValue({
      userId: "u1", mfaRequired: false,
      memberships: [membership, { ...membership, id: "m2", organizationId: "o2", organization: { ...membership.organization, id: "o2", name: "School Two" } }],
    });
    render(<ProfessionalAccessView />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /school two/i }));
    expect(mocks.replace).toHaveBeenCalledWith("/professional?organization=o2");
  });

  it("preserves a case deep link without mounting its content before approval", async () => {
    mocks.pathname = "/professional/cases/fe000000-0000-4000-8000-000000000001";
    mocks.memberships.mockResolvedValue({ userId: "u1", mfaRequired: true, memberships: [membership] });
    render(<ProfessionalWorkspaceGate><p>Private case data</p></ProfessionalWorkspaceGate>);
    expect(screen.queryByText("Private case data")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(
      "/professional/access?next=%2Fprofessional%2Fcases%2Ffe000000-0000-4000-8000-000000000001",
    ));
  });

  it("removes displayed case data when an action loses authorization", async () => {
    mocks.caseDetail.mockResolvedValue({
      request: { id: "case1", status: "assigned", sharingActive: false, preferredTime: "", summary: null },
      sharedJournals: [], sharedPhq8: [], appointments: [], appointmentChangeRequests: [], referrals: [], notes: [], viewer: "professional",
    });
    mocks.close.mockRejectedValue(new AppError({
      code: "AUTHORIZATION_ERROR", userMessage: "Access revoked", statusCode: 403,
    }));
    render(<ProfessionalCaseView id="case1" />);
    expect(await screen.findByRole("heading", { name: "What the user shared" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Close case" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm closure" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "What the user shared" })).not.toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("Access is not available");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Access revoked");
  });
});

vi.mock("@/services/experience/experience-api", () => ({ experienceApi: { getSupportResources: async () => [] } }));

it("coalesces the initial access read during Strict Mode without skipping MFA preparation", async () => {
  mocks.memberships.mockResolvedValue({ userId: "u1", mfaRequired: true, memberships: [membership] });
  mocks.prepareMfa.mockResolvedValue({ id: "synthetic-factor" });
  render(<StrictMode><ProfessionalAccessView /></StrictMode>);
  await screen.findByRole("heading", { name: "Verify your authenticator" });
  expect(mocks.memberships).toHaveBeenCalledTimes(1);
  expect(mocks.prepareMfa).toHaveBeenCalledTimes(1);
  expect(mocks.verifyMfa).not.toHaveBeenCalled();
});
