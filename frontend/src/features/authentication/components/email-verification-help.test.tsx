import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EmailVerificationHelp } from "./email-verification-help";
import { resendVerificationEmail } from "@/services/authentication/resend-verification";
vi.mock("@/services/authentication/resend-verification", () => ({ resendVerificationEmail: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
it("shows the result and prevents repeated sends during cooldown", async () => {
  vi.useFakeTimers();
  vi.mocked(resendVerificationEmail).mockResolvedValue({ success: true, message: "Verification email requested." });
  render(<EmailVerificationHelp email="mira@example.com" />);
  await act(async () => { fireEvent.click(screen.getByRole("button")); });
  expect(resendVerificationEmail).toHaveBeenCalledExactlyOnceWith("mira@example.com");
  expect(screen.getByRole("status")).toHaveTextContent("Verification email requested.");
  expect(screen.getByRole("button", { name: /60s/ })).toBeDisabled();
  for (let seconds = 0; seconds < 60; seconds++) await act(async () => { vi.advanceTimersByTime(1000); });
  expect(screen.getByRole("button", { name: "Resend verification email" })).toBeEnabled();
});
it("keeps sending errors visible and allows retry", async () => {
  vi.mocked(resendVerificationEmail).mockResolvedValue({ success: false, message: "Please try again." });
  render(<EmailVerificationHelp email="mira@example.com" />);
  await act(async () => { fireEvent.click(screen.getByRole("button")); });
  expect(screen.getByRole("alert")).toHaveTextContent("Please try again.");
  expect(screen.getByRole("button")).toBeEnabled();
});
