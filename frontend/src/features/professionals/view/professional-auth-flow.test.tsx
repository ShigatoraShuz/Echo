import { render, screen, waitFor } from "@testing-library/react";
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
  replace: vi.fn(),
  refresh: vi.fn(),
  searchParams: new URLSearchParams(),
  pathname: "/professional",
  getCurrentSession: vi.fn(),
  caseDetail: vi.fn(),
  close: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
  useSearchParams: () => mocks.searchParams,
  usePathname: () => mocks.pathname,
}));
vi.mock("@/services/professionals/professional-api", () => ({
  professionalApi: { memberships: mocks.memberships, caseDetail: mocks.caseDetail, close: mocks.close },
}));
vi.mock("@/services/authentication/reviewer-mfa", () => ({
  prepareReviewerMfa: mocks.prepareMfa,
  verifyReviewerMfa: vi.fn(),
}));
vi.mock("@/services/authentication/auth-service.factory", () => ({
  getAuthService: () => ({ getCurrentSession: mocks.getCurrentSession }),
}));
vi.mock("@/features/authentication/view/login-view", () => ({
  LoginView: ({ destination }: { destination: string }) => <p>Login destination: {destination}</p>,
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParams = new URLSearchParams();
  mocks.pathname = "/professional";
  mocks.getCurrentSession.mockResolvedValue({ success: true, data: null });
});

describe("professional auth flow", () => {
  it("sends an existing session through access while limiting the return path", async () => {
    mocks.searchParams = new URLSearchParams("next=%2Fprofessional%2Frequest");
    mocks.getCurrentSession.mockResolvedValue({ success: true, data: { isMockSession: false } });
    render(<ProfessionalLoginView />);
    expect(screen.getByText("Login destination: /professional/access?next=%2Fprofessional")).toBeInTheDocument();
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
      sharedJournals: [], appointments: [], referrals: [], notes: [], viewer: "professional",
    });
    mocks.close.mockRejectedValue(new AppError({
      code: "AUTHORIZATION_ERROR", userMessage: "Access revoked", statusCode: 403,
    }));
    render(<ProfessionalCaseView id="case1" />);
    expect(await screen.findByRole("heading", { name: "What the user shared" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Close case" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "What the user shared" })).not.toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("Access revoked");
  });
});
