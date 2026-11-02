import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useDashboardViewModel } from "@/features/dashboard/view-model/use-dashboard-view-model";
import { getDashboardService } from "@/services/dashboard/dashboard-service.factory";

vi.mock("@/services/dashboard/dashboard-service.factory", () => ({
  getDashboardService: vi.fn(),
  resetDashboardService: vi.fn(),
}));

function createMockService() {
  return {
    getDashboardData: vi.fn().mockResolvedValue({
      success: true,
      data: {
        userProfile: {
          name: "Mira",
          streakDays: 7,
          nextCheckIn: "Tonight",
          privacyStatus: "private",
        },
        latestEntry: null,
        journalEntries: [],
        moodTrend: [],
        riskTrend: [],
        weeklyDigest: [],
        quickActions: [],
      },
    }),
  };
}

describe("useDashboardViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the initial dashboard snapshot", async () => {
    const mockService = createMockService();
    vi.mocked(getDashboardService).mockReturnValue(mockService as ReturnType<typeof createMockService>);

    const { result } = renderHook(() => useDashboardViewModel());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.userProfile.name).toBe("Mira");
    expect(result.current.error).toBeNull();
  });

  it("reloads when the time range changes", async () => {
    const mockService = createMockService();
    vi.mocked(getDashboardService).mockReturnValue(mockService as ReturnType<typeof createMockService>);

    const { result } = renderHook(() => useDashboardViewModel("30d"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setTimeRange("90d");
    });

    await waitFor(() => {
      expect(mockService.getDashboardData).toHaveBeenCalledWith("90d");
    });

    expect(result.current.timeRange).toBe("90d");
    expect(mockService.getDashboardData).toHaveBeenCalledTimes(2);
  });

  it("keeps the newest range when an older request finishes last", async () => {
    const pending = new Map<string, (value: unknown) => void>();
    const mockService = {
      getDashboardData: vi.fn((range: string) => new Promise((resolve) => pending.set(range, resolve))),
    };
    vi.mocked(getDashboardService).mockReturnValue(mockService as ReturnType<typeof createMockService>);
    const { result } = renderHook(() => useDashboardViewModel());
    await waitFor(() => expect(pending.has("7d")).toBe(true));

    act(() => result.current.setTimeRange("90d"));
    await waitFor(() => expect(pending.has("90d")).toBe(true));
    await act(async () => {
      pending.get("90d")?.({ success: true, data: { userProfile: { name: "Newer" } } });
    });
    await act(async () => {
      pending.get("7d")?.({ success: true, data: { userProfile: { name: "Older" } } });
    });
    expect(result.current.data?.userProfile.name).toBe("Newer");
  });
});
