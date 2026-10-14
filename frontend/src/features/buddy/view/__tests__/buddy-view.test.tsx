import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BuddyView } from "../buddy-view";
import { useBuddyViewModel } from "@/features/buddy/view-model/use-buddy-view-model";
import type { BuddyConversation, BuddyPagination } from "@/features/buddy/model/buddy.model";

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: vi.fn(),
    configurable: true,
  });
});

class MockRecognition {
  static instance: MockRecognition | null = null;

  continuous = false;
  interimResults = false;
  lang = "en-US";
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onresult: ((event: {
    resultIndex: number;
    results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } };
  }) => void) | null = null;
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();

  constructor() {
    MockRecognition.instance = this;
  }

  emitFinal(transcript: string) {
    this.onresult?.({
      resultIndex: 0,
      results: {
        length: 1,
        0: { isFinal: true, 0: { transcript } },
      },
    });
  }
}

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
    historyEnabled: true,
    isLoadingMessages: false,
    isSending: false,
    messages: [{ id: "1", conversationId: "conv-1", content: "Hello", role: "buddy" as const, timestamp: "8:00 PM" }],
    activeConversationId: "conv-1" as string | null,
    error: null as string | null,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    loadConversations: vi.fn(),
    selectConversation: vi.fn(),
    clearConversation: vi.fn(),
    createConversation: vi.fn(),
    renameConversation: vi.fn(),
    pinConversation: vi.fn(),
    deleteConversation: vi.fn(),
    retryMessage: vi.fn(),
    sendFeedback: vi.fn(),
    conversations: [] as BuddyConversation[],
    searchConversations: vi.fn(),
    isLoadingList: false,
    selectedConversation: null,
    searchQuery: "",
    pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } as BuddyPagination,
    isStreaming: false,
    streamingContent: "",
  };
}

describe("BuddyView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockRecognition.instance = null;
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/buddy");
  });

  it("reopens a previous chat and keeps its URL for reload and browser back", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    mock.conversations = [
      { id: "conv-1", title: "First chat", pinnedAt: null } as BuddyConversation,
      { id: "conv-2", title: "Earlier chat", pinnedAt: null } as BuddyConversation,
    ];
    vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);

    render(<BuddyView />);
    await user.click(screen.getByText("Earlier chat").closest("button")!);
    expect(mock.selectConversation).toHaveBeenCalledWith("conv-2");
    expect(window.location.search).toBe("?conversation=conv-2");

    window.history.pushState(null, "", "/buddy?conversation=conv-1");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(mock.selectConversation).toHaveBeenCalledWith("conv-1");
  });

  it("loads a linked older chat and sends the next message to that chat", async () => {
    window.history.replaceState(null, "", "/buddy?conversation=conv-2");
    const mock = setupMock();
    mock.activeConversationId = null;
    vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);
    const { rerender } = render(<BuddyView />);
    expect(mock.selectConversation).toHaveBeenCalledWith("conv-2");

    mock.activeConversationId = "conv-2";
    mock.messages = [{ id: "old-reply", conversationId: "conv-2", content: "An earlier reply", role: "buddy", timestamp: "8:00 PM" }];
    rerender(<BuddyView />);
    await userEvent.setup().type(screen.getByLabelText(/message buddy/i), "Following up");
    await userEvent.setup().click(screen.getByRole("button", { name: /send message/i }));
    expect(mock.sendMessage).toHaveBeenCalledWith("conv-2", "Following up");
    expect(screen.getByText("An earlier reply")).toBeInTheDocument();
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

  it("adds final speech recognition text to the draft", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);
    vi.stubGlobal("webkitSpeechRecognition", MockRecognition);
    vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn() });

    render(<BuddyView />);

    await user.click(screen.getByRole("button", { name: /start voice input/i }));
    act(() => {
      MockRecognition.instance?.emitFinal("I feel tense");
    });

    await waitFor(() => expect(screen.getByLabelText(/message buddy/i)).toHaveValue("I feel tense"));
  });

  it("speaks and stops the latest Buddy reply", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    class MockUtterance {
      text: string;
      rate = 1;
      pitch = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(text: string) {
        this.text = text;
      }
    }
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);
    vi.stubGlobal("webkitSpeechRecognition", MockRecognition);
    vi.stubGlobal("speechSynthesis", { speak, cancel });
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);

    render(<BuddyView />);

    await user.click(screen.getByRole("button", { name: /speak latest buddy reply/i }));

    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalled();
  });

  it("disables voice input when speech recognition is unsupported", () => {
    const mock = setupMock();
    vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);

    render(<BuddyView />);

    expect(screen.getByRole("button", { name: /start voice input/i })).toBeDisabled();
  });

  it("hides pin actions without the pin migration and offers history retry", async () => {
    const user = userEvent.setup();
    const base = setupMock();
    const mock = {
      ...base,
      activeConversationId: null,
      error: "Buddy history could not be loaded.",
      pagination: { ...base.pagination, pinsAvailable: false },
      conversations: [{ id: "conv-1", title: "Evening", pinnedAt: null, lastMessageAt: "Today" }] as BuddyConversation[],
    };
    vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);

    render(<BuddyView />);
    expect(screen.queryByText("Pinned chats")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pin Evening" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry history" }));
    expect(mock.loadConversations).toHaveBeenCalled();
  });

  it("preserves the draft when sending fails", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    mock.sendMessage.mockResolvedValue(false);
    vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);
    render(<BuddyView />);
    await user.type(screen.getByLabelText(/message buddy/i), "Please stay with me");
    await user.click(screen.getByRole("button", { name: /send message/i }));
    expect(screen.getByLabelText(/message buddy/i)).toHaveValue("Please stay with me");
  });
});
