import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useForgotPasswordViewModel } from "./use-forgot-password-view-model";
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

describe("useForgotPasswordViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has idle initial state", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useForgotPasswordViewModel());

    expect(result.current.email).toBe("");
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.successMessage).toBeNull();
  });

  it("updates email via setEmail", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useForgotPasswordViewModel());

    act(() => result.current.setEmail("test@example.com"));
    expect(result.current.email).toBe("test@example.com");
  });

  it("sets field errors on invalid email", async () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useForgotPasswordViewModel());

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.fieldErrors.email).toBeDefined();
    expect(mockService.forgotPassword).not.toHaveBeenCalled();
  });

  it("calls service on valid email", async () => {
    const mockService = createMockService();
    mockService.forgotPassword.mockResolvedValue({ success: true, data: { message: "Reset link sent." } });
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useForgotPasswordViewModel());

    act(() => result.current.setEmail("test@example.com"));

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.status).toBe("success");
    expect(result.current.successMessage).toBe("Reset link sent.");
    expect(mockService.forgotPassword).toHaveBeenCalledWith({ email: "test@example.com" });
  });

  it("sets error on service failure", async () => {
    const mockError = { code: "NETWORK", message: "Unable to connect." };
    const mockService = createMockService();
    mockService.forgotPassword.mockResolvedValue({ success: false, error: mockError });
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useForgotPasswordViewModel());

    act(() => result.current.setEmail("test@example.com"));

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toEqual(mockError);
  });

  it("resets to initial state", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useForgotPasswordViewModel());

    act(() => result.current.setEmail("test@example.com"));
    act(() => result.current.reset());

    expect(result.current.email).toBe("");
    expect(result.current.status).toBe("idle");
    expect(result.current.successMessage).toBeNull();
  });
});
