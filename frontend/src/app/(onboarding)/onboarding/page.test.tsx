import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import OnboardingPage from "./page";
import { getOnboardingService } from "@/services/onboarding/onboarding-service.factory";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/services/onboarding/onboarding-service.factory", () => ({ getOnboardingService: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

function account(onboardingCompleted: boolean) {
  const completeOnboarding = vi.fn().mockResolvedValue({ success: true, data: undefined });
  vi.mocked(getOnboardingService).mockReturnValue({
    getStatus: vi.fn().mockResolvedValue({ success: true, data: { onboardingCompleted, onboardingStep: 2, displayName: "Test student" } }),
    saveConsent: vi.fn(), saveProfile: vi.fn(), saveSetup: vi.fn(), completeOnboarding,
  });
  return completeOnboarding;
}

it("offers the walkthrough after a new account finishes onboarding", async () => {
  const complete = account(false);
  const user = userEvent.setup();
  render(<OnboardingPage />);
  await user.click(await screen.findByRole("button", { name: "Enter my ECHO space" }));
  expect(await screen.findByRole("dialog", { name: "Welcome to ECHO" })).toBeVisible();
  expect(complete).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Skip tour" }));
  expect(router.replace).toHaveBeenCalledExactlyOnceWith("/dashboard");
});

it("redirects returning accounts without showing the walkthrough", async () => {
  const complete = account(true);
  render(<OnboardingPage />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
  expect(screen.queryByRole("dialog", { name: "Welcome to ECHO" })).not.toBeInTheDocument();
  expect(complete).not.toHaveBeenCalled();
});
