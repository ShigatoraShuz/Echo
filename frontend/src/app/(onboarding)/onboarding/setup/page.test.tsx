import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SetupOnboardingPage from "./page";
import { getOnboardingService } from "@/services/onboarding/onboarding-service.factory";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/services/onboarding/onboarding-service.factory", () => ({ getOnboardingService: vi.fn() }));

describe("SetupOnboardingPage", () => {
  it("saves the optional camera and in-app notification choices", async () => {
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
  });
});
