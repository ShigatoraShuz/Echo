import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGroundingViewModel } from "../view-model/use-grounding-view-model";
import { getGroundingService } from "@/services/grounding/grounding-service.factory";

vi.mock("@/services/grounding/grounding-service.factory", () => ({
  getGroundingService: vi.fn(),
  resetGroundingService: vi.fn(),
}));

function createMockService() {
  return {
    saveSession: vi.fn().mockResolvedValue({
      success: true,
      data: { id: "gs-1", type: "box-breathing", duration: 120, pace: "slow", completedAt: "2026-07-12T00:00:00Z", progress: 100, state: "completed" },
    }),
    getHistory: vi.fn().mockResolvedValue({ success: true, data: [] }),
  };
}

describe("useGroundingViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with the default technique and duration", () => {
    const mockService = createMockService();
    vi.mocked(getGroundingService).mockReturnValue(mockService);

    const { result } = renderHook(() => useGroundingViewModel());
    expect(result.current.technique).toBe("box-breathing");
    expect(result.current.durationMinutes).toBe(2);
    expect(result.current.remainingSeconds).toBe(120);
    expect(result.current.isRunning).toBe(false);
  });

  it("toggles the running state", () => {
    const mockService = createMockService();
    vi.mocked(getGroundingService).mockReturnValue(mockService);

    const { result } = renderHook(() => useGroundingViewModel());
    act(() => {
      result.current.toggleRunning();
    });
    expect(result.current.isRunning).toBe(true);
    act(() => {
      result.current.toggleRunning();
    });
    expect(result.current.isRunning).toBe(false);
  });

  it("changes technique and resets the timer", () => {
    const mockService = createMockService();
    vi.mocked(getGroundingService).mockReturnValue(mockService);

    const { result } = renderHook(() => useGroundingViewModel());
    act(() => {
      result.current.selectTechnique("sensory-5-4-3-2-1");
    });
    expect(result.current.technique).toBe("sensory-5-4-3-2-1");
    expect(result.current.remainingSeconds).toBe(120);
    expect(result.current.isRunning).toBe(false);
  });

  it("changes duration and resets the timer", () => {
    const mockService = createMockService();
    vi.mocked(getGroundingService).mockReturnValue(mockService);

    const { result } = renderHook(() => useGroundingViewModel());
    act(() => {
      result.current.selectDuration(5);
    });
    expect(result.current.durationMinutes).toBe(5);
    expect(result.current.remainingSeconds).toBe(300);
  });

  it("resets the timer to the selected duration", () => {
    const mockService = createMockService();
    vi.mocked(getGroundingService).mockReturnValue(mockService);

    const { result } = renderHook(() => useGroundingViewModel());
    act(() => {
      result.current.selectDuration(10);
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.remainingSeconds).toBe(600);
    expect(result.current.isRunning).toBe(false);
  });

  it("starts a selected practice and saves it once when elapsed", async () => {
    vi.useFakeTimers();
    try {
      const mockService = createMockService();
      vi.mocked(getGroundingService).mockReturnValue(mockService);
      const { result } = renderHook(() => useGroundingViewModel());
      await act(async () => { await Promise.resolve(); });

      act(() => result.current.startPractice("body-scan", 2));
      expect(result.current.isRunning).toBe(true);
      expect(result.current.technique).toBe("body-scan");

      await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
      expect(result.current.remainingSeconds).toBe(0);
      expect(result.current.isRunning).toBe(false);
      expect(mockService.saveSession).toHaveBeenCalledTimes(1);
      expect(mockService.saveSession).toHaveBeenCalledWith(expect.objectContaining({ type: "body-scan", duration: 120 }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("reconciles an elapsed practice immediately when a background tab returns", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-17T08:00:00Z"));
      const mockService = createMockService();
      vi.mocked(getGroundingService).mockReturnValue(mockService);
      const { result } = renderHook(() => useGroundingViewModel());
      await act(async () => { await Promise.resolve(); });
      act(() => result.current.startPractice("body-scan", 2));

      vi.setSystemTime(new Date("2026-10-17T08:03:00Z"));
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
        await Promise.resolve();
      });

      expect(result.current.remainingSeconds).toBe(0);
      expect(result.current.isRunning).toBe(false);
      expect(mockService.saveSession).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovers history after a failed request", async () => {
    const mockService = createMockService();
    mockService.getHistory
      .mockResolvedValueOnce({ success: false, error: { code: "UNAVAILABLE", message: "History unavailable" } })
      .mockResolvedValueOnce({ success: true, data: [{ id: "gs-1", type: "box-breathing", duration: 120, pace: "slow", completedAt: "2026-07-12T00:00:00Z", progress: 100, state: "completed" }] });
    vi.mocked(getGroundingService).mockReturnValue(mockService);
    const { result } = renderHook(() => useGroundingViewModel());
    await waitFor(() => expect(result.current.historyError).toBe("History unavailable"));
    act(() => result.current.reloadHistory());
    await waitFor(() => expect(result.current.history).toHaveLength(1));
    expect(result.current.historyError).toBeNull();
  });

  it("explains an uncertain completed-session save without retrying the POST", async () => {
    vi.useFakeTimers();
    try {
      const mockService = createMockService();
      mockService.saveSession.mockRejectedValueOnce(new Error("Connection lost"));
      vi.mocked(getGroundingService).mockReturnValue(mockService);
      const { result } = renderHook(() => useGroundingViewModel());
      await act(async () => { await Promise.resolve(); });
      act(() => result.current.startPractice("body-scan", 2));
      await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
      expect(result.current.saveError).toBe(true);
      expect(result.current.status).toContain("retry safely");
      expect(mockService.saveSession).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries an uncertain save with the same practice ID", async () => {
    vi.useFakeTimers();
    try {
      const mockService = createMockService();
      mockService.saveSession.mockRejectedValueOnce(new Error("Connection lost"));
      vi.mocked(getGroundingService).mockReturnValue(mockService);
      const { result } = renderHook(() => useGroundingViewModel());
      await act(async () => { await Promise.resolve(); });
      act(() => result.current.startPractice("body-scan", 2));
      await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
      expect(result.current.saveError).toBe(true);

      await act(async () => { result.current.retrySave(); await Promise.resolve(); });
      expect(mockService.saveSession).toHaveBeenCalledTimes(2);
      expect(mockService.saveSession.mock.calls[1][0]).toEqual(mockService.saveSession.mock.calls[0][0]);
      expect(result.current.saveError).toBe(false);
      expect(result.current.history).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
