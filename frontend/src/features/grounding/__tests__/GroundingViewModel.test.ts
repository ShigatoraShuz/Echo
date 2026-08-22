import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGroundingViewModel } from "../view-model/use-grounding-view-model";
import { getGroundingService } from "@/services/grounding/grounding-service.factory";

vi.mock("../services/grounding-service.factory", () => ({
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
      result.current.selectTechnique("5-4-3-2-1");
    });
    expect(result.current.technique).toBe("5-4-3-2-1");
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
});