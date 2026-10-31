import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfessionalLoginView } from "./professional-login-view";
import type { AuthSession } from "@/features/authentication/model/auth.model";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), refresh: vi.fn() }, searchParams: new URLSearchParams(),
  getCurrentSession: vi.fn(), login: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router, useSearchParams: () => mocks.searchParams,
}));
vi.mock("@/services/authentication/auth-service.factory", () => ({ getAuthService: () => mocks }));

const session: AuthSession = {
  user: { id: "synthetic-user", name: "Synthetic Professional", email: "professional@example.test" },
  expiresAt: "2099-01-01T00:00:00Z", isMockSession: false,
};
const destination = "/professional/access?next=%2Fprofessional";

beforeEach(() => {
  mocks.searchParams = new URLSearchParams();
  mocks.getCurrentSession.mockResolvedValue({ success: true, data: null });
  mocks.login.mockResolvedValue({ success: true, data: session });
});

async function passwordForm() {
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "professional@example.test" } });
  fireEvent.change(screen.getByPlaceholderText("Enter your password"), { target: { value: "synthetic-password" } });
}

describe("professional login presentation and authentication", () => {
  it.each(["sign_in_session_expired", "access_check_unavailable", "access_service_unavailable", "login_required"])("does not loop a cached session through a failing gateway after %s", async (error) => {
    mocks.searchParams = new URLSearchParams({ error, next: "/professional?organization=synthetic" });
    mocks.getCurrentSession.mockResolvedValue({ success: true, data: session });
    render(<ProfessionalLoginView />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await act(async () => undefined);
    expect(mocks.getCurrentSession).not.toHaveBeenCalled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
    await passwordForm();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(mocks.router.replace).toHaveBeenCalledWith("/professional/access?next=%2Fprofessional%3Forganization%3Dsynthetic");
  });
  it("offers supported methods, public navigation and an accessible approval explanation", async () => {
    const { container } = render(<ProfessionalLoginView />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Email code" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /google|move your account/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Personal sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: /create an account/i })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/");
    expect(screen.getByText(/professional access still requires approved membership/i)).toBeInTheDocument();
    // CSS contrast, breakpoint geometry and iframe focus require browser QA.
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
    await passwordForm();
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });

  it("preserves password, visibility and session controls through the existing auth service", async () => {
    render(<ProfessionalLoginView />);
    await passwordForm();
    await userEvent.setup().click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByPlaceholderText("Enter your password")).toHaveAttribute("type", "text");
    await userEvent.setup().click(screen.getByLabelText(/remember me/i));
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in" }));
    expect(mocks.login).toHaveBeenCalledWith({ email: "professional@example.test", password: "synthetic-password", rememberSession: true });
    expect(mocks.router.replace).toHaveBeenCalledWith(destination);
    expect(mocks.router.refresh).not.toHaveBeenCalled();
  });

  it.each(["https://other.example/", "//other.example/", "/professional/request"])("limits an unapproved return path %s for password sign-in", async (next) => {
    mocks.searchParams = new URLSearchParams({ next });
    render(<ProfessionalLoginView />);
    await passwordForm();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in" }));
    expect(mocks.router.replace).toHaveBeenCalledWith(destination);
  });

  it("preserves an allowed case deep link through the access gateway", async () => {
    const next = "/professional/cases/fe000000-0000-4000-8000-000000000001";
    mocks.searchParams = new URLSearchParams({ next });
    render(<ProfessionalLoginView />);
    await passwordForm();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in" }));
    expect(mocks.router.replace).toHaveBeenCalledWith(`/professional/access?next=${encodeURIComponent(next)}`);
  });

  it("shows busy feedback, disables competing controls and prevents duplicate password submission", async () => {
    let finish!: (value: { success: true; data: AuthSession }) => void;
    mocks.login.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<ProfessionalLoginView />);
    await passwordForm();
    const form = screen.getByRole("form", { name: "Password sign in" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(mocks.login).toHaveBeenCalledTimes(1);
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    expect(screen.getByLabelText(/email address/i)).toBeDisabled();
    await act(async () => finish({ success: true, data: session }));
    expect(mocks.router.replace).toHaveBeenCalledTimes(1);
  });

  it("focuses the first invalid field and exposes its associated error", async () => {
    render(<ProfessionalLoginView />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in" }));
    const email = screen.getByLabelText(/email address/i);
    expect(email).toHaveFocus();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Email is required");
    expect(mocks.login).not.toHaveBeenCalled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("announces account errors and restores controls for retry", async () => {
    mocks.login.mockResolvedValue({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Check your email and password." } });
    render(<ProfessionalLoginView />);
    await passwordForm();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Check your email and password.");
    expect(screen.getByRole("alert").parentElement).toHaveFocus();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("recovers from an unexpected provider failure without losing entered credentials", async () => {
    mocks.login.mockRejectedValueOnce(new Error("Synthetic provider failure"));
    render(<ProfessionalLoginView />);
    await passwordForm();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in could not be reached. Check your connection and try again.");
    expect(screen.getByLabelText(/email address/i)).toHaveValue("professional@example.test");
    expect(screen.getByPlaceholderText("Enter your password")).toHaveValue("synthetic-password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(screen.getByPlaceholderText("Enter your password")).toHaveValue("synthetic-password");
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in" }));
    expect(mocks.router.replace).toHaveBeenCalledWith(destination);
  });

  it("explains expired sessions accessibly", () => {
    mocks.searchParams = new URLSearchParams("error=sign_in_session_expired");
    render(<ProfessionalLoginView />);
    expect(screen.getByRole("alert")).toHaveTextContent("Your sign-in session expired. Please sign in again.");
  });

  it.each(["toString", "unexpected-private-message"])("does not display an unsupported query error %s", (error) => {
    mocks.searchParams = new URLSearchParams({ error });
    render(<ProfessionalLoginView />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("routes an existing real session through approval without starting another login", async () => {
    mocks.getCurrentSession.mockResolvedValue({ success: true, data: session });
    render(<ProfessionalLoginView />);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith(destination));
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it("does not use a mock session as professional approval", async () => {
    mocks.getCurrentSession.mockResolvedValue({ success: true, data: { ...session, isMockSession: true } });
    render(<ProfessionalLoginView />);
    await waitFor(() => expect(mocks.getCurrentSession).toHaveBeenCalled());
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });
});
