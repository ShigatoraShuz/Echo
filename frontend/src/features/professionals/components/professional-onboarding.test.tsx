import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Membership } from "@/services/professionals/professional-api";
import { ProfessionalOnboarding } from "./professional-onboarding";
import { ProfessionalCredentialForm } from "./professional-credential-form";
import { ProfessionalOnboardingPreview } from "../dev/professional-onboarding-preview";
import { ProfessionalAccessView } from "../view/professional-access-view";
import { validateCredentialPreview } from "../professional-onboarding.model";

const mocks = vi.hoisted(() => ({
  memberships: vi.fn(), prepareMfa: vi.fn(), verifyMfa: vi.fn(), fetch: vi.fn(),
  router: { replace: vi.fn(), refresh: vi.fn() }, searchParams: new URLSearchParams(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router, useSearchParams: () => mocks.searchParams }));
vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: { memberships: mocks.memberships } }));
vi.mock("@/services/authentication/reviewer-mfa", () => ({ prepareReviewerMfa: mocks.prepareMfa, verifyReviewerMfa: mocks.verifyMfa }));
vi.mock("./professional-shell", () => ({
  ProfessionalShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  ProfessionalSkeleton: () => <p role="status">Checking application status</p>,
}));

const ORG = "fc000000-0000-4000-8000-000000000001";
const membership: Membership = {
  id: "sample-member", organizationId: ORG,
  organization: { id: ORG, slug: "synthetic", name: "Synthetic Care Organization", description: "Synthetic organization", location: "", serviceTypes: [], consultationMethods: [], serviceHours: "", status: "active" },
  role: "counselor", status: "pending", displayName: "Synthetic professional", credentialLabel: "Synthetic qualification", credentialExpiresAt: "2099-12-31", accessState: "pending_membership",
};
beforeEach(() => { vi.stubGlobal("fetch", mocks.fetch); mocks.searchParams = new URLSearchParams(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("professional onboarding membership presentation", () => {
  it.each([
    ["pending_membership", "Professional approval pending"], ["pending_organization", "Organization review pending"],
    ["suspended_membership", "Professional access suspended"], ["suspended_organization", "Organization access suspended"],
    ["credential_expired", "Credential renewal required"], ["active", "Approved"],
  ] as const)("shows the supported %s state without granting access", (accessState, label) => {
    render(<ProfessionalOnboarding memberships={[{ ...membership, accessState }]} />);
    expect(screen.getByText(label, { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Synthetic Care Organization")).toBeInTheDocument();
    expect(screen.getByText(/2099/)).toBeInTheDocument();
    expect(mocks.memberships).not.toHaveBeenCalled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("explains no membership and keeps live credential fields and actions disabled", () => {
    render(<ProfessionalOnboarding memberships={[]} />);
    expect(screen.getByText("No professional membership yet")).toBeInTheDocument();
    expect(screen.getByText(/No credential history has been loaded/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Qualification label/i)).toBeDisabled();
    expect(screen.getByLabelText(/Evidence reference/i)).toBeDisabled();
    for (const name of ["Submit credential", "Upload document"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled(); fireEvent.click(button);
    }
    fireEvent.submit(screen.getByRole("form", { name: "Credential submission unavailable" }));
    expect(screen.queryByText(/Sample details pass validation/i)).not.toBeInTheDocument();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("does not show synthetic review data on the live component", () => {
    render(<ProfessionalOnboarding memberships={[]} credentials={[{
      id: "fake", organizationName: "Synthetic", credentialLabel: "Synthetic credential", status: "approved",
      expiresAt: "2099-12-31", submittedAt: "2026-10-12", reviewedAt: "2026-10-13", reasonCode: null,
    }]} />);
    expect(screen.queryByText("Credential approved")).not.toBeInTheDocument();
    expect(screen.queryByText("Synthetic credential review")).not.toBeInTheDocument();
  });

  it("uses the existing memberships endpoint for refresh without calling credential endpoints", async () => {
    mocks.memberships.mockResolvedValue({ userId: "sample", mfaRequired: true, memberships: [membership] });
    render(<ProfessionalAccessView />);
    expect(await screen.findByText("Professional approval pending")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Check approval status" }));
    expect(mocks.memberships).toHaveBeenCalledTimes(2);
    expect(mocks.prepareMfa).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("shows loading and recoverable real membership errors", async () => {
    let fail!: (error: Error) => void;
    mocks.memberships.mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject; }));
    render(<ProfessionalAccessView />);
    expect(screen.getByText("Checking application status")).toBeInTheDocument();
    await act(async () => fail(new Error("Synthetic failure")));
    expect(screen.getByRole("alert")).toHaveTextContent("Professional access could not be checked");
    mocks.memberships.mockResolvedValue({ userId: "sample", mfaRequired: true, memberships: [] });
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No professional membership yet")).toBeInTheDocument();
  });

  it("lets newly approved access continue through the existing MFA gate after refresh", async () => {
    mocks.memberships.mockResolvedValueOnce({ userId: "sample", mfaRequired: true, memberships: [membership] });
    render(<ProfessionalAccessView />);
    await screen.findByText("Professional approval pending");
    mocks.memberships.mockResolvedValue({ userId: "sample", mfaRequired: true, memberships: [{ ...membership, accessState: "active", status: "active" }] });
    mocks.prepareMfa.mockResolvedValue({ id: "synthetic-factor" });
    await userEvent.setup().click(screen.getByRole("button", { name: "Check approval status" }));
    expect(await screen.findByRole("heading", { name: "Verify your authenticator" })).toBeInTheDocument();
    expect(screen.getByText("Membership approved")).toBeInTheDocument();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });
});

describe("isolated credential preview validation", () => {
  const valid = { organizationId: ORG, role: "counselor", credentialLabel: "Synthetic qualification", expiresAt: "2099-12-31", evidenceReference: "Fictional registry reference for UI testing only." };
  it.each([
    ["organizationId", "invalid"], ["role", "org_admin"], ["credentialLabel", "A"],
    ["credentialLabel", "a".repeat(161)], ["expiresAt", "2026-02-30"], ["expiresAt", "2020-01-01"],
    ["evidenceReference", "Too short"], ["evidenceReference", "x".repeat(4001)],
  ])("rejects invalid %s", (field, value) => {
    expect(validateCredentialPreview({ ...valid, [field]: value }, "2026-10-13")).toHaveProperty(field);
  });
  it("accepts today's expiry and all supported clinical roles", () => {
    for (const role of ["counselor", "psychologist", "social_worker"]) {
      expect(validateCredentialPreview({ ...valid, role, expiresAt: "2026-10-13" }, "2026-10-13")).toEqual({});
    }
  });

  it("focuses invalid fields and clearly distinguishes validation from submission", async () => {
    render(<ProfessionalCredentialForm preview organizations={[{ id: ORG, name: "Synthetic Care Organization" }]} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Check sample details" }));
    const organization = screen.getByRole("combobox", { name: /Organization/i });
    expect(organization).toHaveFocus();
    expect(organization).toHaveAccessibleDescription("Choose an organization.");
    await userEvent.setup().selectOptions(organization, ORG);
    await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: /Professional role/i }), "counselor");
    fireEvent.change(screen.getByLabelText(/Qualification label/i), { target: { value: valid.credentialLabel } });
    fireEvent.change(screen.getByLabelText(/Credential expiry date/i), { target: { value: valid.expiresAt } });
    fireEvent.change(screen.getByLabelText(/Evidence reference/i), { target: { value: valid.evidenceReference } });
    await userEvent.setup().click(screen.getByRole("button", { name: "Check sample details" }));
    expect(screen.getByText("Sample details pass validation")).toBeInTheDocument();
    expect(screen.getByText(/No application was submitted/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit credential" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Upload document" })).toBeDisabled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", "No sample credential application yet."], ["pending", "Awaiting review"],
    ["approved", "Credential approved"], ["access_approved", "Membership approved"],
    ["rejected", "Evidence needs attention"], ["expired", "Credential expired"],
    ["suspended", "Professional access suspended"], ["loading", "Checking application status"],
    ["error", "Application status unavailable"],
  ])("inspects %s entirely offline without changing access", async (state, text) => {
    render(<ProfessionalOnboardingPreview />);
    await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: "Onboarding preview state" }), state);
    expect(screen.getByText(text, { selector: ":not(option)" })).toBeInTheDocument();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.memberships).not.toHaveBeenCalled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
    if (state === "approved") expect(screen.getByText("Professional approval pending")).toBeInTheDocument();
    if (state === "error") {
      await userEvent.setup().click(screen.getByRole("button", { name: "Retry sample state" }));
      expect(screen.getByText("Awaiting review")).toBeInTheDocument();
    }
  });

  it("keeps pending and rejected preview states structurally accessible", async () => {
    const { container } = render(<ProfessionalOnboardingPreview />);
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
    await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: "Onboarding preview state" }), "rejected");
    await waitFor(() => expect(screen.getByText("Evidence needs attention")).toBeInTheDocument());
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });
});
