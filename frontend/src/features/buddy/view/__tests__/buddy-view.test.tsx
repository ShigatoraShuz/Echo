import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BuddyView } from "../buddy-view";
import { useBuddyViewModel } from "@/features/buddy/view-model/use-buddy-view-model";

beforeEach(() => {
  window.history.replaceState({}, "", "/buddy");
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: vi.fn(),
    configurable: true,
  });
});

vi.mock("@/features/buddy/view-model/use-buddy-view-model", () => ({
  useBuddyViewModel: vi.fn(),
}));

vi.mock("@/features/buddy/components/buddy-chat-bubble", () => ({
  BuddyChatBubble: ({ message }: { message: { content: string } }) => <div>{message.content}</div>,
}));

vi.mock("@/shared/components/ui/echo-motion-surface", () => ({
  EchoMotionSurface: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function setupMock() {
  return {
    accessStatus: "allowed" as const,
    isLoadingMessages: false,
    isSending: false,
    messages: [{ id: "1", conversationId: "conv-1", content: "Hello", role: "buddy" as const, timestamp: "8:00 PM" }],
    activeConversationId: "conv-1",
    error: null,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    loadConversations: vi.fn(),
    selectConversation: vi.fn(),
    conversations: [],
    isLoadingList: false,
    pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
  };
}

describe("BuddyView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("supports prompt chips, typing, and sending", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);

    render(<BuddyView />);

    await user.click(screen.getByRole("button", { name: /reflect on today/i }));
    await user.type(screen.getByLabelText(/message buddy/i), "I need a calmer plan");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(mock.sendMessage).toHaveBeenCalledWith("conv-1", expect.any(String));
  });

  it("opens the conversation requested by the history link", async () => {
    const conversationId = "00000000-0000-4000-8000-000000000042";
    window.history.replaceState({}, "", `/buddy?conversationId=${conversationId}`);
    const mock = setupMock();
    vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);

    render(<BuddyView />);

    await waitFor(() => expect(mock.selectConversation).toHaveBeenCalledWith(conversationId));
  });
});
