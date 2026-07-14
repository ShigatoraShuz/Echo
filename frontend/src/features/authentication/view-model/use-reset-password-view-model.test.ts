import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useResetPasswordViewModel } from "./use-reset-password-view-model";
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

describe("useResetPasswordViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has idle initial state", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useResetPasswordViewModel());

    expect(result.current.token).toBe("");
    expect(result.current.password).toBe("");
    expect(result.current.confirmPassword).toBe("");
    expect(result.current.showPassword).toBe(false);
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.passwordStrength.score).toBe(0);
  });

  it("updates fields via setters", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useResetPasswordViewModel());

    act(() => result.current.setToken("test-token-123"));
    act(() => result.current.setPassword("NewStr0ng!"));
    act(() => result.current.setConfirmPassword("NewStr0ng!"));

    expect(result.current.token).toBe("test-token-123");
    expect(result.current.password).toBe("NewStr0ng!");
    expect(result.current.confirmPassword).toBe("NewStr0ng!");
  });

  it("toggles showPassword", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useResetPasswordViewModel());

    act(() => result.current.togglePasswordVisibility());
    expect(result.current.showPassword).toBe(true);
  });

  it("computes password strength", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useResetPasswordViewModel());

    expect(result.current.passwordStrength.score).toBe(0);

    act(() => result.current.setPassword("NewStr0ng!"));
    expect(result.current.passwordStrength.score).toBe(85);
    expect(result.current.passwordStrength.label).toBe("Moderate");
  });

  it("sets field errors on invalid submission (no token)", async () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useResetPasswordViewModel());

    act(() => result.current.setPassword("NewStr0ng!"));
    act(() => result.current.setConfirmPassword("NewStr0ng!"));

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.fieldErrors.token).toBeDefined();
    expect(mockService.resetPassword).not.toHaveBeenCalled();
  });

  it("calls service on valid submission", async () => {
    const mockSession = { user: { id: "1", name: "User", email: "user@test.com" }, expiresAt: "2026-07-15", isMockSession: true };
    const mockService = createMockService();
    mockService.resetPassword.mockResolvedValue({ success: true, data: mockSession });
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useResetPasswordViewModel());

    act(() => result.current.setToken("valid-token"));
    act(() => result.current.setPassword("NewStr0ng!"));
    act(() => result.current.setConfirmPassword("NewStr0ng!"));

    let returned: unknown;
    await act(async () => {
      returned = await result.current.submit();
    });

    expect(result.current.status).toBe("success");
    expect(mockService.resetPassword).toHaveBeenCalled();
    expect(returned).toEqual(mockSession);
  });

  it("sets error on service failure", async () => {
    const mockError = { code: "WEAK_PASSWORD", message: "Password must be at least 8 characters." };
    const mockService = createMockService();
    mockService.resetPassword.mockResolvedValue({ success: false, error: mockError });
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useResetPasswordViewModel());

    act(() => result.current.setToken("valid-token"));
    act(() => result.current.setPassword("NewStr0ng!"));
    act(() => result.current.setConfirmPassword("NewStr0ng!"));

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toEqual(mockError);
  });

  it("resets to initial state", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useResetPasswordViewModel());

    act(() => result.current.setToken("valid-token"));
    act(() => result.current.setPassword("NewStr0ng!"));
    act(() => result.current.reset());

    expect(result.current.token).toBe("");
    expect(result.current.password).toBe("");
    expect(result.current.confirmPassword).toBe("");
    expect(result.current.status).toBe("idle");
  });
});
