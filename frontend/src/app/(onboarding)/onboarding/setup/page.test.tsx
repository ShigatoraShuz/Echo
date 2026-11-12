import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SetupOnboardingPage from "./page";
import { getOnboardingService } from "@/services/onboarding/onboarding-service.factory";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/services/onboarding/onboarding-service.factory", () => ({ getOnboardingService: vi.fn() }));

describe("SetupOnboardingPage", () => {
  it("saves the optional camera and in-app notification choices", async () => {
    replace.mockClear();
    const saveSetup = vi.fn().mockResolvedValue({ success: true, data: undefined });
    vi.mocked(getOnboardingService).mockReturnValue({
      getStatus: vi.fn(),
      saveConsent: vi.fn(),
      saveProfile: vi.fn(),
      saveSetup,
      completeOnboarding: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    });

    render(<SetupOnboardingPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("switch", { name: "Allow optional camera check-ins" }));
    await user.click(screen.getByRole("switch", { name: "Analysis-ready updates in app" }));
    await user.click(screen.getByRole("button", { name: "Open dashboard" }));

    await waitFor(() => expect(saveSetup).toHaveBeenCalledWith({
      theme: "system",
      notifications: false,
      facialAnalysis: true,
    }));
    expect(screen.queryByText(/journal analysis are now activated/i)).not.toBeInTheDocument();
    const dialog = within(await screen.findByRole("dialog", { name: "Welcome to ECHO" }));
    expect(replace).not.toHaveBeenCalled();
    expect(dialog.getByText("Step 1 of 4")).toBeVisible();
    await user.click(dialog.getByRole("button", { name: "Next" }));
    expect(dialog.getByRole("heading", { name: "Write in Journal, revisit in Insights" })).toBeVisible();
    await user.click(dialog.getByRole("button", { name: "Back" }));
    expect(dialog.getByText("Step 1 of 4")).toBeVisible();
    for (let step = 0; step < 3; step++) await user.click(dialog.getByRole("button", { name: "Next" }));
    expect(dialog.getByText("Step 4 of 4")).toBeVisible();
    await user.click(dialog.getByRole("button", { name: "Go to Dashboard" }));
    expect(replace).toHaveBeenCalledExactlyOnceWith("/dashboard");
  });
});


it("lets a new user skip the walkthrough after setup succeeds", async () => {
  replace.mockClear();
  const success = vi.fn().mockResolvedValue({ success: true, data: undefined });
  vi.mocked(getOnboardingService).mockReturnValue({
    getStatus: vi.fn(), saveConsent: vi.fn(), saveProfile: vi.fn(), saveSetup: success, completeOnboarding: success,
  });
  const user = userEvent.setup();
  render(<SetupOnboardingPage />);
  await user.click(screen.getByRole("button", { name: "Open dashboard" }));
  await user.click(await screen.findByRole("button", { name: "Skip tour" }));
  expect(replace).toHaveBeenCalledExactlyOnceWith("/dashboard");
});
