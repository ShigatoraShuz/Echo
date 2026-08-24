import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOnboardingViewModel } from "@/features/onboarding/view-model/use-onboarding-view-model";

describe("useOnboardingViewModel", () => {
  it("starts at the first step with default state", () => {
    const { result } = renderHook(() => useOnboardingViewModel());

    expect(result.current.currentStep).toBe(0);
    expect(result.current.profile.displayName).toBe("");
    expect(result.current.setup.theme).toBe("system");
    expect(result.current.consent.terms).toBe(false);
    expect(result.current.steps).toHaveLength(4);
  });

  it("updates onboarding sections and clamps navigation", () => {
    const { result } = renderHook(() => useOnboardingViewModel());

    act(() => {
      result.current.updateConsent("terms", true);
      result.current.updateProfile({ displayName: "Mira", timezone: "Asia/Shanghai" });
      result.current.updateSetup({ theme: "dark", notifications: false });
      result.current.nextStep();
      result.current.nextStep();
      result.current.nextStep();
      result.current.nextStep();
      result.current.prevStep();
    });

    expect(result.current.consent.terms).toBe(true);
    expect(result.current.profile.displayName).toBe("Mira");
    expect(result.current.profile.timezone).toBe("Asia/Shanghai");
    expect(result.current.setup.theme).toBe("dark");
    expect(result.current.setup.notifications).toBe(false);
    expect(result.current.currentStep).toBe(2);
  });
});
