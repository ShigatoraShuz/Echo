import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, it, expect, vi } from "vitest";
import { LoginView } from "../login-view";
const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), send: vi.fn(), login: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../../components/secure-google-login-button", () => ({
  SecureGoogleLoginButton: () => <button>Google sign in</button>,
}));
vi.mock("@/services/authentication/auth-service.factory", () => ({
  getAuthService: () => ({ requestEmailCode: mocks.send, login: mocks.login }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ success: true, data: { message: "Sent" } });
});
it("keeps protected navigation closed until the code is verified", async () => {
  render(<LoginView title="Welcome back" description="Sign in" />);
  expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "person@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send sign-in code" }));
  await screen.findByLabelText("Email sign-in code");
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /Resend in/ })).toBeDisabled();
  mocks.login.mockResolvedValue({ success: true, data: { user: { id: "owner" } } });
  fireEvent.change(screen.getByLabelText("Email sign-in code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify code and sign in" }));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/dashboard"));
});
it("retains Google and crisis access", () => {
  render(<LoginView title="Welcome back" description="Sign in" />);
  expect(screen.getByRole("button", { name: "Google sign in" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Get immediate support" })).toHaveAttribute("href", "/crisis");
});
