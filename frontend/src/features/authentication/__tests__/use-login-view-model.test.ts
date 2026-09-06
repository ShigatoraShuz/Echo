import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { useLoginViewModel } from "../view-model/use-login-view-model";
const auth = vi.hoisted(() => ({ requestEmailCode: vi.fn(), login: vi.fn() }));
vi.mock("@/services/authentication/auth-service.factory", () => ({ getAuthService: () => auth }));
beforeEach(() => {
  vi.clearAllMocks();
  auth.requestEmailCode.mockResolvedValue({ success: true, data: { message: "Sent" } });
});
afterEach(() => vi.useRealTimers());
describe("Email code sign-in state", () => {
  it("rejects invalid email before sending", async () => {
    const { result } = renderHook(() => useLoginViewModel());
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.error?.code).toBe("VALIDATION");
    expect(auth.requestEmailCode).not.toHaveBeenCalled();
  });
  it("does not establish a session when sending and enforces resend cooldown", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLoginViewModel());
    act(() => result.current.setEmail("person@example.com"));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.sent).toBe(true);
    expect(auth.login).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.sendCode();
    });
    expect(auth.requestEmailCode).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 60; i++) act(() => vi.advanceTimersByTime(1000));
    await act(async () => {
      await result.current.sendCode();
    });
    expect(auth.requestEmailCode).toHaveBeenCalledTimes(2);
  });
  it("handles expired code and permits retry", async () => {
    const { result } = renderHook(() => useLoginViewModel());
    act(() => result.current.setEmail("person@example.com"));
    await act(async () => {
      await result.current.sendCode();
    });
    act(() => result.current.setCode("123456"));
    auth.login.mockResolvedValue({ success: false, error: { code: "EXPIRED_TOKEN", message: "Code expired" } });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.error?.code).toBe("EXPIRED_TOKEN");
    auth.login.mockResolvedValue({ success: true, data: { user: { id: "owner" } } });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.status).toBe("success");
  });
  it("handles invalid codes and network rejection without an open session", async () => {
    const { result } = renderHook(() => useLoginViewModel());
    act(() => result.current.setEmail("person@example.com"));
    await act(async () => {
      await result.current.sendCode();
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.error?.code).toBe("INVALID_TOKEN");
    act(() => result.current.setCode("123456"));
    auth.login.mockRejectedValue(Error("network"));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.status).toBe("error");
  });
  it("clears the code when changing email", async () => {
    const { result } = renderHook(() => useLoginViewModel());
    act(() => {
      result.current.setEmail("person@example.com");
      result.current.setCode("123456");
    });
    act(() => result.current.changeEmail());
    expect(result.current.code).toBe("");
    expect(result.current.sent).toBe(false);
  });
});
