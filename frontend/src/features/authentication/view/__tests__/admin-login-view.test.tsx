import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminLoginPage from "@/app/(auth)/admin-login/page";

const mocks = vi.hoisted(() => ({ prepareMfa: vi.fn(), verifyMfa: vi.fn(), login: vi.fn(), reviewerAccess: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("@/services/authentication/reviewer-mfa", () => ({prepareReviewerMfa: mocks.prepareMfa, verifyReviewerMfa: mocks.verifyMfa}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/services/authentication/auth-service.factory", () => ({ getAuthService: () => ({ login: mocks.login }) }));
vi.mock("@/services/verification/verification-api", () => ({
  verificationApi: { reviewerAccess: mocks.reviewerAccess },
}));

function submit() {
  fireEvent.change(screen.getByLabelText(/admin email/i), { target: { value: "reviewer@example.invalid" } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "test-only-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in as admin" }));
}

beforeEach(() => {
  mocks.prepareMfa.mockResolvedValue(null);
  mocks.verifyMfa.mockResolvedValue(undefined);
  mocks.login.mockResolvedValue({ success: true, data: { isMockSession: false } });
  mocks.reviewerAccess.mockResolvedValue({ canReview: true });
});

describe("Dedicated admin sign in", () => {
  it("provides an accessible empty form, password visibility, and no public admin registration", () => {
    render(<AdminLoginPage />);
    expect(screen.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
    expect(screen.getByText(/Public sign-up does not grant admin access/)).toBeVisible();
    expect(screen.getByLabelText(/admin email/i)).toHaveValue("");
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute("type", "text");
    expect(screen.getByRole("link", { name: "Back to sign up" })).toHaveAttribute("href", "/signup");
    fireEvent.click(screen.getByRole("button", { name: "Sign in as admin" }));
    expect(mocks.login).not.toHaveBeenCalled();
    expect(mocks.reviewerAccess).not.toHaveBeenCalled();
  });

  it("checks backend permission before redirecting, without trusting a role from login", async () => {
    let resolveAccess!: (value: { canReview: boolean }) => void;
    mocks.reviewerAccess.mockReturnValue(
      new Promise((resolve) => {
        resolveAccess = resolve;
      }),
    );
    render(<AdminLoginPage />);
    submit();
    await waitFor(() => expect(mocks.reviewerAccess).toHaveBeenCalledOnce());
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Checking access…" })).toBeDisabled();
    expect(screen.getByLabelText(/admin email/i)).toBeDisabled();
    resolveAccess({ canReview: true });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/admin/verifications"));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(screen.getByLabelText(/^password/i)).toHaveValue("");
    expect(mocks.login).toHaveBeenCalledWith({
      email: "reviewer@example.invalid",
      password: "test-only-password",
      rememberSession: false,
    });
  });

  it("denies non-reviewers without navigating and allows another attempt", async () => {
    mocks.reviewerAccess.mockResolvedValueOnce({ canReview: false });
    render(<AdminLoginPage />);
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("does not have administrator access");
    expect(mocks.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sign in as admin" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/admin/verifications"));
  });

  it("fails closed on network errors and offers a retry", async () => {
    mocks.reviewerAccess.mockRejectedValueOnce(new Error("private diagnostic"));
    render(<AdminLoginPage />);
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Administrator access could not be checked");
    expect(screen.queryByText(/private diagnostic/)).not.toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign in as admin" })).toBeEnabled();
  });

  it("does not check roles after invalid credentials", async () => {
    mocks.login.mockResolvedValue({ success: false, error: { message: "Invalid login credentials" } });
    render(<AdminLoginPage />);
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid login credentials");
    expect(mocks.reviewerAccess).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("rejects simulated sessions", async () => {
    mocks.login.mockResolvedValue({ success: true, data: { isMockSession: true } });
    render(<AdminLoginPage />);
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Demo sessions cannot access");
    expect(mocks.reviewerAccess).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});

it("requires MFA before checking reviewer access and allows retrying an invalid code", async () => {
 mocks.prepareMfa.mockResolvedValue({id:"factor-1"});
 mocks.verifyMfa.mockRejectedValueOnce(new Error("private diagnostic"));
 render(<AdminLoginPage />); submit();
 const field = await screen.findByLabelText(/Authenticator code/);
 expect(mocks.reviewerAccess).not.toHaveBeenCalled();
 fireEvent.change(field,{target:{value:"123456"}});
 fireEvent.click(screen.getByRole("button",{name:"Verify authenticator"}));
 expect(await screen.findByRole("alert")).toHaveTextContent("Check your code");
 expect(mocks.replace).not.toHaveBeenCalled();
 fireEvent.change(field,{target:{value:"654321"}});
 fireEvent.click(screen.getByRole("button",{name:"Verify authenticator"}));
 await waitFor(()=>expect(mocks.replace).toHaveBeenCalledWith("/admin/verifications"));
 expect(mocks.verifyMfa).toHaveBeenLastCalledWith("factor-1","654321");
});
