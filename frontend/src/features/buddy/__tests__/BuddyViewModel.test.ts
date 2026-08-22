import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useBuddyViewModel } from "../view-model/use-buddy-view-model";
import { getBuddyService } from "@/services/buddy/buddy-service.factory";

vi.mock("../services/buddy-service.factory", () => ({
  getBuddyService: vi.fn(),
  resetBuddyService: vi.fn(),
}));

function createMockService() {
  return {
    getAccessStatus: vi.fn().mockResolvedValue({ success: true, data: { canAccessAi: true } }),
    listConversations: vi.fn().mockResolvedValue({
      success: true,
      data: {
        conversations: [
          { id: "conv-1", title: "Evening grounding", lastMessage: "I am here with you.", lastMessageAt: "Today", messageCount: 8, mood: "anxious", createdAt: "2026-07-12" },
        ],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      },
    }),
    searchConversations: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getConversation: vi.fn().mockResolvedValue({
      success: true,
      data: {
        messages: [
          { id: "m1", conversationId: "conv-1", role: "buddy", content: "I am here with you.", timestamp: "8:18 PM" },
        ],
      },
    }),
    createConversation: vi.fn(),
    renameConversation: vi.fn(),
    deleteConversation: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    sendMessage: vi.fn().mockResolvedValue({
      success: true,
      data: { id: "m2", conversationId: "conv-1", role: "buddy", content: "Thank you for sharing.", timestamp: "8:20 PM" },
    }),
    retryMessage: vi.fn(),
    sendFeedback: vi.fn().mockResolvedValue({ success: true, data: undefined }),
  };
}

describe("useBuddyViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading access status initially", () => {
    const mockService = createMockService();
    vi.mocked(getBuddyService).mockReturnValue(mockService);

    const { result } = renderHook(() => useBuddyViewModel());
    expect(result.current.accessStatus).toBe("loading");
  });

  it("allows access after status resolves", async () => {
    const mockService = createMockService();
    vi.mocked(getBuddyService).mockReturnValue(mockService);

    const { result } = renderHook(() => useBuddyViewModel());

    await waitFor(() => {
      expect(result.current.accessStatus).toBe("allowed");
    });
  });

  it("blocks access when verification is missing", async () => {
    const mockService = createMockService();
    mockService.getAccessStatus = vi.fn().mockResolvedValue({ success: true, data: { canAccessAi: false } });
    vi.mocked(getBuddyService).mockReturnValue(mockService);

    const { result } = renderHook(() => useBuddyViewModel());

    await waitFor(() => {
      expect(result.current.accessStatus).toBe("blocked");
    });
  });

  it("loads conversations and auto-selects the first one", async () => {
    const mockService = createMockService();
    vi.mocked(getBuddyService).mockReturnValue(mockService);

    const { result } = renderHook(() => useBuddyViewModel());

    await waitFor(() => {
      expect(result.current.isLoadingList).toBe(false);
    });

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.activeConversationId).toBe("conv-1");
  });

  it("sends a message with an optimistic user message", async () => {
    const mockService = createMockService();
    vi.mocked(getBuddyService).mockReturnValue(mockService);

    const { result } = renderHook(() => useBuddyViewModel());

    await waitFor(() => {
      expect(result.current.isLoadingList).toBe(false);
    });

    act(() => {
      void result.current.sendMessage("conv-1", "Hello");
    });

    await waitFor(() => {
      expect(result.current.messages.some((m) => m.role === "user" && m.content === "Hello")).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.messages.some((m) => m.role === "buddy" && m.content === "Thank you for sharing.")).toBe(true);
    });
  });

  it("removes the optimistic message when sending fails", async () => {
    const mockService = createMockService();
    mockService.sendMessage = vi.fn().mockResolvedValue({
      success: false,
      error: { code: "NETWORK", message: "Network error" },
    });
    vi.mocked(getBuddyService).mockReturnValue(mockService);

    const { result } = renderHook(() => useBuddyViewModel());

    await waitFor(() => {
      expect(result.current.isLoadingList).toBe(false);
    });

    act(() => {
      void result.current.sendMessage("conv-1", "Hello");
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Network error");
    });

    expect(result.current.messages.some((m) => m.content === "Hello")).toBe(false);
  });
});