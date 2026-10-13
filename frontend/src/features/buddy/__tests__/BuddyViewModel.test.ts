import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useBuddyViewModel } from "../view-model/use-buddy-view-model";
import { getBuddyService } from "@/services/buddy/buddy-service.factory";

vi.mock("@/services/buddy/buddy-service.factory", () => ({
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
    getConversation: vi.fn().mockResolvedValue({
      success: true,
      data: {
        messages: [
          { id: "m1", conversationId: "conv-1", role: "buddy", content: "I am here with you.", timestamp: "8:18 PM" },
        ],
      },
    }),
    pinConversation: vi.fn().mockResolvedValue({ success: true, data: "2026-07-12T00:00:00Z" }),
    createConversation: vi.fn(),
    renameConversation: vi.fn(),
    deleteConversation: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    sendMessage: vi.fn().mockResolvedValue({
      success: true,
      data: { conversationId: "conv-1", persisted: true, messages: [
        { id: "m2", conversationId: "conv-1", role: "user", content: "Hello", timestamp: "8:20 PM" },
        { id: "m3", conversationId: "conv-1", role: "buddy", content: "Thank you for sharing.", timestamp: "8:20 PM" },
      ] },
    }),
    retryMessage: vi.fn(),
    sendFeedback: vi.fn().mockResolvedValue({ success: true, data: undefined }),
  };
}

describe("useBuddyViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading access status initially", async () => {
    const mockService = createMockService();
    vi.mocked(getBuddyService).mockReturnValue(mockService);

    const { result } = renderHook(() => useBuddyViewModel());
    expect(result.current.accessStatus).toBe("loading");

    await waitFor(() => {
      expect(result.current.accessStatus).toBe("allowed");
    });
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
      expect(result.current.accessStatus).toBe("verification");
    });
  });

  it("loads history without silently selecting an older conversation", async () => {
    const mockService = createMockService();
    vi.mocked(getBuddyService).mockReturnValue(mockService);

    const { result } = renderHook(() => useBuddyViewModel());

    await waitFor(() => {
      expect(result.current.isLoadingList).toBe(false);
    });

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.activeConversationId).toBeNull();
    expect(mockService.getConversation).not.toHaveBeenCalled();
  });

  it("stops loading and exposes a recoverable history error", async () => {
    const mockService = createMockService();
    mockService.listConversations.mockResolvedValueOnce({ success: false, error: { code: "NETWORK", message: "History unavailable" } });
    vi.mocked(getBuddyService).mockReturnValue(mockService);

    const { result } = renderHook(() => useBuddyViewModel());
    await waitFor(() => expect(result.current.error).toBe("History unavailable"));
    expect(result.current.isLoadingList).toBe(false);

    await act(async () => { await result.current.loadConversations(); });
    await waitFor(() => expect(result.current.conversations).toHaveLength(1));
    expect(result.current.activeConversationId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("keeps a history search applied when loading the next page", async () => {
    const mockService = createMockService();
    vi.mocked(getBuddyService).mockReturnValue(mockService);
    const { result } = renderHook(() => useBuddyViewModel());
    await waitFor(() => expect(result.current.isLoadingList).toBe(false));

    await act(async () => { await result.current.searchConversations("calm"); });
    await act(async () => { await result.current.loadConversations(2); });
    expect(mockService.listConversations).toHaveBeenLastCalledWith(2, 20, expect.any(AbortSignal), "calm");
  });

  it("sends a message with an optimistic user message", async () => {
    const mockService = createMockService();
    vi.mocked(getBuddyService).mockReturnValue(mockService);

    const { result } = renderHook(() => useBuddyViewModel());

    await waitFor(() => {
      expect(result.current.isLoadingList).toBe(false);
    });

    await act(async () => {
      await result.current.sendMessage("conv-1", "Hello");
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

    await act(async () => {
      await result.current.sendMessage("conv-1", "Hello");
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Network error");
    });

    expect(result.current.messages.some((m) => m.content === "Hello")).toBe(false);
  });

  it("starts a separate saved conversation and selects its own id", async () => {
    const mockService = createMockService();
    mockService.createConversation.mockResolvedValue({ success: true, data: {
      id: "conv-new", title: "Buddy conversation", lastMessage: "", lastMessageAt: "", messageCount: 0,
      mood: "neutral", createdAt: "2026-10-13T00:00:00Z",
    } });
    vi.mocked(getBuddyService).mockReturnValue(mockService);
    const { result } = renderHook(() => useBuddyViewModel());
    await waitFor(() => expect(result.current.isLoadingList).toBe(false));
    await act(async () => { await result.current.createConversation(); });
    expect(result.current.activeConversationId).toBe("conv-new");
    expect(result.current.messages).toEqual([]);
  });

  it("does not keep the previous chat active if starting a new one fails", async () => {
    const mockService = createMockService();
    mockService.createConversation.mockResolvedValue({ success: false, error: { code: "NETWORK", message: "Could not start chat" } });
    vi.mocked(getBuddyService).mockReturnValue(mockService);
    const { result } = renderHook(() => useBuddyViewModel());
    await waitFor(() => expect(result.current.isLoadingList).toBe(false));
    await act(async () => { await result.current.selectConversation("conv-1"); });
    await act(async () => { await result.current.createConversation(); });
    expect(result.current.activeConversationId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBe("Could not start chat");
  });

  it("keeps temporary chats in memory without sending a saved conversation id", async () => {
    const mockService = createMockService();
    mockService.getAccessStatus.mockResolvedValue({ success: true, data: { canAccessAi: true, buddyHistoryEnabled: false } });
    mockService.sendMessage.mockResolvedValue({ success: true, data: { conversationId: null, persisted: false, messages: [
      { id: "temporary-user", conversationId: "temporary", role: "user", content: "Hello", timestamp: "Now" },
      { id: "temporary-buddy", conversationId: "temporary", role: "buddy", content: "I hear you.", timestamp: "Now" },
    ] } });
    vi.mocked(getBuddyService).mockReturnValue(mockService);
    const { result, unmount } = renderHook(() => useBuddyViewModel());
    await waitFor(() => expect(result.current.accessStatus).toBe("allowed"));
    await act(async () => { await result.current.sendMessage(null, "Hello"); });
    expect(mockService.createConversation).not.toHaveBeenCalled();
    expect(mockService.sendMessage).toHaveBeenCalledWith({ content: "Hello" });
    expect(result.current.messages).toHaveLength(2);
    unmount();
    const fresh = renderHook(() => useBuddyViewModel());
    expect(fresh.result.current.messages).toEqual([]);
  });
});
