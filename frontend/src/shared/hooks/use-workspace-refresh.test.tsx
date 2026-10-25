import { act, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { useWorkspaceRefresh } from "./use-workspace-refresh";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-24"));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("coalesces focus/visibility, refreshes mutations and polls only while visible", () => {
  const refresh = vi.fn();
  renderHook(() => useWorkspaceRefresh(refresh, "actor:org"));
  act(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(refresh).toHaveBeenCalledTimes(1);
  act(() => {
    vi.advanceTimersByTime(1100);
    window.dispatchEvent(new Event("echo:appointments-changed"));
  });
  expect(refresh).toHaveBeenCalledTimes(2);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  act(() => vi.advanceTimersByTime(120000));
  expect(refresh).toHaveBeenCalledTimes(2);
});
it("stops on clearing, cleans up old scope, and uses the current role callback", () => {
  const first = vi.fn(),
    second = vi.fn(),
    clear = vi.fn();
  const { rerender, unmount } = renderHook(({ scope, refresh }) => useWorkspaceRefresh(refresh, scope, clear), {
    initialProps: { scope: "a:one:counselor", refresh: first },
  });
  rerender({ scope: "a:two:org_admin", refresh: second });
  act(() => window.dispatchEvent(new Event("focus")));
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  act(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
  act(() => {
    vi.advanceTimersByTime(120000);
    window.dispatchEvent(new Event("focus"));
  });
  expect(clear).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);
  unmount();
});

it("refreshes notification changes and coalesces a simultaneous appointment signal", () => {
  const refresh = vi.fn();
  renderHook(() => useWorkspaceRefresh(refresh, "actor:org"));
  act(() => { window.dispatchEvent(new Event("echo:appointments-changed")); window.dispatchEvent(new Event("echo:notifications-changed")); });
  expect(refresh).toHaveBeenCalledTimes(1);
  act(() => { vi.advanceTimersByTime(1100); window.dispatchEvent(new Event("echo:notifications-changed")); });
  expect(refresh).toHaveBeenCalledTimes(2);
});
