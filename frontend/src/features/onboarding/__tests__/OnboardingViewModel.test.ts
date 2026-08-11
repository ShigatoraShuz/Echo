import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOnboardingViewModel } from "../view-model/use-onboarding-view-model";

vi.mock("../services/onboarding-service.factory", () => ({
  getOnboardingService: vi.fn(),
  resetOnboardingService: vi.fn(),
}));

describe("useOnboardingViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts at first step", () => {
    const { result } = renderHook(() => useOnboardingViewModel());
    expect(result.current.currentStep).toBe(0);
    expect(result.current.steps).toHaveLength(4);
  });

  it("advances through steps", () => {
    const { result } = renderHook(() => useOnboardingViewModel());
    act(() => {
      result.current.nextStep();
    });
    expect(result.current.currentStep).toBe(1);
    act(() => {
      result.current.nextStep();
    });
    expect(result.current.currentStep).toBe(2);
  });

  it("does not go below step 0", () => {
    const { result } = renderHook(() => useOnboardingViewModel());
    act(() => {
      result.current.prevStep();
    });
    expect(result.current.currentStep).toBe(0);
  });

  it("does not exceed total steps", () => {
    const { result } = renderHook(() => useOnboardingViewModel());
    act(() => {
      for (let i = 0; i < 10; i++) result.current.nextStep();
    });
    expect(result.current.currentStep).toBe(3);
  });

  it("updates consent values", () => {
    const { result } = renderHook(() => useOnboardingViewModel());
    act(() => {
      result.current.updateConsent("terms", true);
    });
    expect(result.current.consent.terms).toBe(true);
    expect(result.current.consent.privacy).toBe(false);
  });

  it("updates profile fields", () => {
    const { result } = renderHook(() => useOnboardingViewModel());
    act(() => {
      result.current.updateProfile({ displayName: "Alex", timezone: "Asia/Manila" });
    });
    expect(result.current.profile.displayName).toBe("Alex");
    expect(result.current.profile.timezone).toBe("Asia/Manila");
  });

  it("updates setup preferences", () => {
    const { result } = renderHook(() => useOnboardingViewModel());
    act(() => {
      result.current.updateSetup({ notifications: false });
    });
    expect(result.current.setup.notifications).toBe(false);
    expect(result.current.setup.theme).toBe("system");
  });
});