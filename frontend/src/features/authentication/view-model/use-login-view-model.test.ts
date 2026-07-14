import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLoginViewModel } from "./use-login-view-model";
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

describe("useLoginViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has idle initial state", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useLoginViewModel());

    expect(result.current.email).toBe("");
    expect(result.current.password).toBe("");
    expect(result.current.rememberSession).toBe(false);
    expect(result.current.showPassword).toBe(false);
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.fieldErrors).toEqual({});
  });

  it("updates email via setEmail", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useLoginViewModel());

    act(() => result.current.setEmail("test@example.com"));
    expect(result.current.email).toBe("test@example.com");
  });

  it("updates password via setPassword", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useLoginViewModel());

    act(() => result.current.setPassword("secret123"));
    expect(result.current.password).toBe("secret123");
  });

  it("updates rememberSession via setRememberSession", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useLoginViewModel());

    act(() => result.current.setRememberSession(true));
    expect(result.current.rememberSession).toBe(true);
  });

  it("toggles showPassword", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useLoginViewModel());

    act(() => result.current.togglePasswordVisibility());
    expect(result.current.showPassword).toBe(true);

    act(() => result.current.togglePasswordVisibility());
    expect(result.current.showPassword).toBe(false);
  });

  it("sets field errors on invalid submission", async () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useLoginViewModel());

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.fieldErrors.email).toBeDefined();
    expect(result.current.fieldErrors.password).toBeDefined();
    expect(result.current.status).toBe("idle");
    expect(mockService.login).not.toHaveBeenCalled();
  });

  it("calls service and returns data on success", async () => {
    const mockSession = { user: { id: "1", name: "Mira", email: "mira@test.com" }, expiresAt: "2026-07-15", isMockSession: true };
    const mockService = createMockService();
    mockService.login.mockResolvedValue({ success: true, data: mockSession });
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useLoginViewModel());

    act(() => result.current.setEmail("mira@test.com"));
    act(() => result.current.setPassword("password123"));

    let returned: unknown;
    await act(async () => {
      returned = await result.current.submit();
    });

    expect(result.current.status).toBe("success");
    expect(result.current.error).toBeNull();
    expect(mockService.login).toHaveBeenCalledWith({ email: "mira@test.com", password: "password123", rememberSession: false });
    expect(returned).toEqual(mockSession);
  });

  it("sets error on service failure", async () => {
    const mockError = { code: "INVALID_CREDENTIALS", message: "Invalid email or password." };
    const mockService = createMockService();
    mockService.login.mockResolvedValue({ success: false, error: mockError });
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useLoginViewModel());

    act(() => result.current.setEmail("mira@test.com"));
    act(() => result.current.setPassword("password123"));

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toEqual(mockError);
  });

  it("resets to initial state", () => {
    const mockService = createMockService();
    vi.mocked(getAuthService).mockReturnValue(mockService);

    const { result } = renderHook(() => useLoginViewModel());

    act(() => result.current.setEmail("test@example.com"));
    act(() => result.current.setPassword("secret123"));
    act(() => result.current.reset());

    expect(result.current.email).toBe("");
    expect(result.current.password).toBe("");
    expect(result.current.rememberSession).toBe(false);
    expect(result.current.showPassword).toBe(false);
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.fieldErrors).toEqual({});
  });
});
