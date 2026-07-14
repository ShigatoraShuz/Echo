import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSignupViewModel } from "./use-signup-view-model";
import { getAuthService } from "../services/auth-service.factory";

vi.mock("../services/auth-service.factory", () => ({
  getAuthService: vi.fn(),
  resetAuthService: vi.fn(),
}));

function createMockService() {
  return {
    login: vi.fn(),
    signup: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    getCurrentSession: vi.fn(),
    logout: vi.fn(),
  };
}

describe("useSignupViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has idle initial state", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useSignupViewModel());

    expect(result.current.name).toBe("");
    expect(result.current.email).toBe("");
    expect(result.current.password).toBe("");
    expect(result.current.confirmPassword).toBe("");
    expect(result.current.termsAccepted).toBe(false);
    expect(result.current.privacyAcknowledged).toBe(false);
    expect(result.current.showPassword).toBe(false);
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.passwordStrength.score).toBe(0);
  });

  it("updates fields via setters", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useSignupViewModel());

    act(() => result.current.setName("Mira"));
    act(() => result.current.setEmail("mira@test.com"));
    act(() => result.current.setPassword("StrongP@ss1"));
    act(() => result.current.setConfirmPassword("StrongP@ss1"));
    act(() => result.current.setTermsAccepted(true));
    act(() => result.current.setPrivacyAcknowledged(true));

    expect(result.current.name).toBe("Mira");
    expect(result.current.email).toBe("mira@test.com");
    expect(result.current.password).toBe("StrongP@ss1");
    expect(result.current.confirmPassword).toBe("StrongP@ss1");
    expect(result.current.termsAccepted).toBe(true);
    expect(result.current.privacyAcknowledged).toBe(true);
  });

  it("computes password strength", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useSignupViewModel());

    expect(result.current.passwordStrength.score).toBe(0);
    expect(result.current.passwordStrength.label).toBe("");

    act(() => result.current.setPassword("abc"));
    expect(result.current.passwordStrength.score).toBeGreaterThan(0);

    act(() => result.current.setPassword("StrongP@ss1"));
    expect(result.current.passwordStrength.score).toBe(85);
    expect(result.current.passwordStrength.label).toBe("Moderate");
  });

  it("sets field errors on invalid submission", async () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useSignupViewModel());

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.fieldErrors.name).toBeDefined();
    expect(result.current.fieldErrors.email).toBeDefined();
    expect(result.current.fieldErrors.password).toBeDefined();
    expect(mockService.signup).not.toHaveBeenCalled();
  });

  it("calls service on valid submission", async () => {
    const mockSession = { user: { id: "1", name: "Mira", email: "mira@test.com" }, expiresAt: "2026-07-15", isMockSession: true };
    const mockService = createMockService();
    mockService.signup.mockResolvedValue({ success: true, data: mockSession });
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useSignupViewModel());

    act(() => result.current.setName("Mira"));
    act(() => result.current.setEmail("mira@test.com"));
    act(() => result.current.setPassword("StrongP@ss1"));
    act(() => result.current.setConfirmPassword("StrongP@ss1"));
    act(() => result.current.setTermsAccepted(true));
    act(() => result.current.setPrivacyAcknowledged(true));

    let returned: unknown;
    await act(async () => {
      returned = await result.current.submit();
    });

    expect(result.current.status).toBe("success");
    expect(mockService.signup).toHaveBeenCalled();
    expect(returned).toEqual(mockSession);
  });

  it("sets error on service failure", async () => {
    const mockError = { code: "EMAIL_IN_USE", message: "An account with this email already exists." };
    const mockService = createMockService();
    mockService.signup.mockResolvedValue({ success: false, error: mockError });
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useSignupViewModel());

    act(() => result.current.setName("Mira"));
    act(() => result.current.setEmail("mira@test.com"));
    act(() => result.current.setPassword("StrongP@ss1"));
    act(() => result.current.setConfirmPassword("StrongP@ss1"));
    act(() => result.current.setTermsAccepted(true));
    act(() => result.current.setPrivacyAcknowledged(true));

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toEqual(mockError);
  });

  it("resets to initial state", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useSignupViewModel());

    act(() => result.current.setName("Mira"));
    act(() => result.current.reset());

    expect(result.current.name).toBe("");
    expect(result.current.status).toBe("idle");
  });
});
