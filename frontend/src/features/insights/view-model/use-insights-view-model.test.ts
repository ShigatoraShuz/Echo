import { createElement, StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getInsightsService } from "@/services/insights/insights-service.factory";
import { useInsightsViewModel } from "./use-insights-view-model";
import type { DashboardInsights } from "@echo/contracts";
vi.mock("@/services/insights/insights-service.factory", () => ({ getInsightsService: vi.fn() }));
const snapshot = (count: number) => ({ success: true as const, data: { latest: null, recommendation: null, emotionTrend: [], distressTrend: [], period: { range: "30d", from: "2026-10-01", to: "2026-10-31", analyzedReflectionCount: count } } as DashboardInsights });
function deferred() {
  let resolve!: (v: ReturnType<typeof snapshot>) => void;
  const promise = new Promise<ReturnType<typeof snapshot>>(done => { resolve = done; });
  return { promise, resolve };
}
function service(read: ReturnType<typeof vi.fn>) { vi.mocked(getInsightsService).mockReturnValue({ getAnalysisOverview: read } as never); }
describe("Insights private read lifecycle", () => {
  it("revalidates after persisted completion without polling or duplicate concurrent requests", async () => {
    const fresh = deferred();
    const read = vi.fn().mockResolvedValueOnce(snapshot(0)).mockReturnValue(fresh.promise); service(read);
    const { result } = renderHook(() => useInsightsViewModel());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => { window.dispatchEvent(new Event("echo:analysis-completed")); });
    expect(read).toHaveBeenCalledTimes(2);
    await act(async () => fresh.resolve(snapshot(1)));
    expect(result.current.overview?.period?.analyzedReflectionCount).toBe(1);
  });
  it("performs one fresh read after invalidation races with an older pending read", async () => {
    const stale = deferred(); const fresh = deferred();
    const read = vi.fn().mockReturnValueOnce(stale.promise).mockReturnValue(fresh.promise); service(read);
    const { result } = renderHook(() => useInsightsViewModel());
    act(() => { window.dispatchEvent(new Event("echo:analysis-completed")); window.dispatchEvent(new Event("echo:analysis-completed")); });
    expect(read).toHaveBeenCalledTimes(1);
    await act(async () => stale.resolve(snapshot(0)));
    expect(read).toHaveBeenCalledTimes(2);
    await act(async () => fresh.resolve(snapshot(1)));
    expect(result.current.overview?.period?.analyzedReflectionCount).toBe(1);
  });
  it("rejects late data and refreshes after logout/account invalidation", async () => {
    const old = deferred(); const read = vi.fn().mockReturnValue(old.promise); service(read);
    const { result } = renderHook(() => useInsightsViewModel());
    act(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
    await act(async () => old.resolve(snapshot(99)));
    act(() => window.dispatchEvent(new Event("echo:analysis-completed")));
    expect(result.current.overview).toBeNull(); expect(read).toHaveBeenCalledTimes(1);
  });
  it("does not let an old date range overwrite the current range", async () => {
    const old = deferred(); const read = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(snapshot(7)); service(read);
    const { result } = renderHook(() => useInsightsViewModel());
    act(() => result.current.setTimeRange("7d"));
    await waitFor(() => expect(result.current.overview?.period?.analyzedReflectionCount).toBe(7));
    await act(async () => old.resolve(snapshot(30)));
    expect(result.current.overview?.period?.analyzedReflectionCount).toBe(7); expect(read).toHaveBeenCalledTimes(2);
  });
  it("exposes a safe error and allows retry", async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error("fictional failure")).mockResolvedValue(snapshot(1)); service(read);
    const { result } = renderHook(() => useInsightsViewModel());
    await waitFor(() => expect(result.current.error).toMatch(/retry/i));
    await act(async () => { await result.current.retry(); });
    expect(result.current.error).toBeNull(); expect(result.current.overview).not.toBeNull();
  });
});

it("reuses one pending private read during Strict Mode replay", async () => {
  const pending = deferred(); const read = vi.fn().mockReturnValue(pending.promise); service(read);
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(StrictMode, null, children);
  const { result } = renderHook(() => useInsightsViewModel(), { wrapper });
  expect(read).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve(snapshot(1)));
  expect(result.current.isLoading).toBe(false);
  expect(result.current.overview?.period?.analyzedReflectionCount).toBe(1);
});
