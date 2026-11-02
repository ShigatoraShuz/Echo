import { createElement, StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDashboardViewModel } from "../view-model/use-dashboard-view-model";
import type { DashboardData } from "../model/dashboard.model";

const snapshot = (name: string) => ({ success: true as const, data: { userProfile: { name } } as DashboardData });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
describe("dashboard request lifecycle", () => {
  it("requests a new range once rather than in both its handler and effect", async () => {
    const getDashboardData = vi.fn().mockResolvedValue(snapshot("Fictional student"));
    const service = { getDashboardData };
    const { result } = renderHook(() => useDashboardViewModel("7d", service));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    getDashboardData.mockClear();
    act(() => result.current.setTimeRange("30d"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getDashboardData).toHaveBeenCalledTimes(1);
  });
  it("coalesces concurrent refreshes and ignores an older range response", async () => {
    const old = deferred<ReturnType<typeof snapshot>>();
    const fresh = deferred<ReturnType<typeof snapshot>>();
    const getDashboardData = vi.fn((range?: string) => range === "7d" ? old.promise : fresh.promise);
    const service = { getDashboardData };
    const { result } = renderHook(() => useDashboardViewModel("7d", service));
    act(() => { window.dispatchEvent(new Event("echo:analysis-completed")); window.dispatchEvent(new Event("echo:analysis-completed")); });
    expect(getDashboardData.mock.calls.filter(([range]) => range === "7d")).toHaveLength(1);
    act(() => result.current.setTimeRange("30d"));
    await act(async () => fresh.resolve(snapshot("Current range")));
    expect(result.current.data?.userProfile.name).toBe("Current range");
    await act(async () => old.resolve(snapshot("Obsolete range")));
    expect(result.current.data?.userProfile.name).toBe("Current range");
  });
  it("clears private data and rejects late responses and refreshes after invalidation", async () => {
    const read = deferred<ReturnType<typeof snapshot>>();
    const getDashboardData = vi.fn().mockReturnValue(read.promise);
    const service = { getDashboardData };
    const { result } = renderHook(() => useDashboardViewModel("7d", service));
    act(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
    await act(async () => read.resolve(snapshot("Prior account")));
    expect(result.current.data).toBeNull();
    act(() => window.dispatchEvent(new Event("echo:analysis-completed")));
    expect(getDashboardData).toHaveBeenCalledTimes(1);
  });
});

it("reuses only the pending request across Strict Mode effect replay", async () => {
  const pending = deferred<ReturnType<typeof snapshot>>();
  const getDashboardData = vi.fn().mockReturnValue(pending.promise);
  const service = { getDashboardData };
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(StrictMode, null, children);
  const { result } = renderHook(() => useDashboardViewModel("7d", service), { wrapper });
  expect(getDashboardData).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve(snapshot("Fictional student")));
  expect(result.current.isLoading).toBe(false);
  expect(result.current.data?.userProfile.name).toBe("Fictional student");
});

it("does not share a pending snapshot with a replacement service", async () => {
  const old = deferred<ReturnType<typeof snapshot>>();
  const oldService = { getDashboardData: vi.fn().mockReturnValue(old.promise) };
  const freshService = { getDashboardData: vi.fn().mockResolvedValue(snapshot("New account")) };
  const { result, rerender } = renderHook(({ service }) => useDashboardViewModel("7d", service), { initialProps: { service: oldService } });
  rerender({ service: freshService });
  await waitFor(() => expect(result.current.data?.userProfile.name).toBe("New account"));
  await act(async () => old.resolve(snapshot("Old account")));
  expect(result.current.data?.userProfile.name).toBe("New account");
  expect(freshService.getDashboardData).toHaveBeenCalledOnce();
});
