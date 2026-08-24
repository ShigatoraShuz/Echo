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
  });
});
