import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailOtpForm } from "../components/email-otp-form";
const service = vi.hoisted(() => ({ sendLoginCode: vi.fn(), verifyLoginCode: vi.fn() }));
vi.mock("@/services/authentication/auth-service.factory", () => ({ getAuthService: () => service }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  service.sendLoginCode.mockResolvedValue({ success: true, data: { message: "sent" } });
});
afterEach(() => vi.useRealTimers());
describe("email code interaction", () => {
  it("keeps email fixed after sending, enforces cooldown and authenticates only after verification", async () => {
    const authenticated = vi.fn();
    render(<EmailOtpForm onAuthenticated={authenticated} />);
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "mira@example.com" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send sign-in code" })));
    expect(authenticated).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/email address/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Resend in 60s" })).toBeDisabled();
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole("button", { name: "Resend code" })).toBeEnabled();
    service.verifyLoginCode.mockResolvedValue({ success: false, error: { message: "Code expired" } });
    fireEvent.change(screen.getByLabelText(/email sign-in code/i), { target: { value: "123456" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Verify code and log in" })));
    expect(screen.getByRole("alert")).toHaveTextContent("Code expired");
    expect(authenticated).not.toHaveBeenCalled();
    service.verifyLoginCode.mockResolvedValue({ success: true, data: {} });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Verify code and log in" })));
    expect(authenticated).toHaveBeenCalledTimes(1);
  });
});
