import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useJournalListViewModel } from "./use-journal-list-view-model";
import { getJournalService } from "../services/journal-service.factory";

vi.mock("../services/journal-service.factory", () => ({
  getJournalService: vi.fn(),
  resetJournalService: vi.fn(),
}));

function createMockService() {
  const entries = [
    {
      id: "1",
      title: "First entry",
      body: "Body",
      excerpt: "Body",
      mood: "calm" as const,
      emotions: [],
      tags: [],
      privacyStatus: "private" as const,
      analysisConsent: false,
      riskScore: 10,
      riskBand: "low" as const,
      summary: "Summary",
      perspective: null,
      createdAt: "2026-07-12",
      updatedAt: "2026-07-12",
    },
    {
      id: "2",
      title: "Second entry",
      body: "Body 2",
      excerpt: "Body 2",
      mood: "sad" as const,
      emotions: [],
      tags: [],
      privacyStatus: "private" as const,
      analysisConsent: false,
      riskScore: 35,
      riskBand: "moderate" as const,
      summary: "Summary 2",
      perspective: null,
      createdAt: "2026-07-11",
      updatedAt: "2026-07-11",
    },
  ];

  return {
    listEntries: vi.fn().mockResolvedValue({
      success: true,
      data: {
        entries,
        pagination: { page: 1, pageSize: 9, totalItems: 2, totalPages: 1 },
      },
    }),
    getEntry: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    saveDraft: vi.fn(),
    getDraft: vi.fn(),
    deleteDraft: vi.fn(),
    requestAnalysis: vi.fn(),
    getAnalysis: vi.fn(),
    exportEntry: vi.fn(),
  };
}

describe("useJournalListViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    const mockService = createMockService();
    vi.mocked(getJournalService).mockReturnValue(mockService);

    const { result } = renderHook(() => useJournalListViewModel());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.entries).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("loads entries on mount", async () => {
    const mockService = createMockService();
    vi.mocked(getJournalService).mockReturnValue(mockService);

    const { result } = renderHook(() => useJournalListViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it("handles empty state", async () => {
    const mockService = createMockService();
    mockService.listEntries = vi.fn().mockResolvedValue({
      success: true,
      data: { entries: [], pagination: { page: 1, pageSize: 9, totalItems: 0, totalPages: 0 } },
    });
    vi.mocked(getJournalService).mockReturnValue(mockService);

    const { result } = renderHook(() => useJournalListViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(0);
  });

  it("handles error state", async () => {
    const mockService = createMockService();
    mockService.listEntries = vi.fn().mockResolvedValue({
      success: false,
      error: { code: "NETWORK", message: "Network error" },
    });
    vi.mocked(getJournalService).mockReturnValue(mockService);

    const { result } = renderHook(() => useJournalListViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Network error");
  });

  it("retries on error", async () => {
    const mockService = createMockService();
    mockService.listEntries = vi.fn()
      .mockResolvedValueOnce({
        success: false,
        error: { code: "NETWORK", message: "Network error" },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          entries: [{
            id: "1",
            title: "Retried",
            body: "Body",
            excerpt: "Body",
            mood: "calm",
            emotions: [],
            tags: [],
            privacyStatus: "private",
            analysisConsent: false,
            riskScore: 10,
            riskBand: "low",
            summary: "Summary",
            perspective: null,
            createdAt: "2026-07-12",
            updatedAt: "2026-07-12",
          }],
          pagination: { page: 1, pageSize: 9, totalItems: 1, totalPages: 1 },
        },
      });
    vi.mocked(getJournalService).mockReturnValue(mockService);

    const { result } = renderHook(() => useJournalListViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Network error");

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.entries).toHaveLength(1);
  });

  it("updates sort filter", async () => {
    const mockService = createMockService();
    vi.mocked(getJournalService).mockReturnValue(mockService);

    const { result } = renderHook(() => useJournalListViewModel());

    act(() => {
      result.current.setSort("oldest");
    });

    expect(result.current.filters.sort).toBe("oldest");
  });

  it("updates page", async () => {
    const mockService = createMockService();
    vi.mocked(getJournalService).mockReturnValue(mockService);

    const { result } = renderHook(() => useJournalListViewModel());

    act(() => {
      result.current.setPage(2);
    });

    expect(result.current.pagination.page).toBe(2);
  });

  it("deletes entry from list", async () => {
    const mockService = createMockService();
    vi.mocked(getJournalService).mockReturnValue(mockService);

    const { result } = renderHook(() => useJournalListViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(2);

    await act(async () => {
      await result.current.deleteEntry("1");
    });

    expect(mockService.deleteEntry).toHaveBeenCalledWith("1");
    expect(result.current.entries).toHaveLength(1);
  });
});
