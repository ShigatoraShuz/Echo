import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfileOnboardingPage from "./page";
import { getOnboardingService } from "@/services/onboarding/onboarding-service.factory";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/services/onboarding/onboarding-service.factory", () => ({
  getOnboardingService: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/config", () => ({
  getSupabasePublicConfig: () => ({ url: "https://example.supabase.co", publishableKey: "pk" }),
}));

vi.mock("@/infrastructure/supabase/browser-client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  }),
}));

describe("ProfileOnboardingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOnboardingService).mockReturnValue({
      getStatus: vi.fn().mockResolvedValue({
        success: true,
        data: {
          onboardingCompleted: false,
          displayName: "Mira Santos",
          timezone: "Asia/Manila",
          consents: {},
        },
      }),
      saveConsent: vi.fn(),
      saveProfile: vi.fn(),
      saveSetup: vi.fn(),
      completeOnboarding: vi.fn(),
    });
  });

  it("prefills the display name from onboarding status", async () => {
    render(<ProfileOnboardingPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/display name/i)).toHaveValue("Mira Santos");
    });
  });
});
