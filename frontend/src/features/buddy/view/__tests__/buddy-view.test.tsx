import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BuddyView } from "../buddy-view";
import { useBuddyViewModel } from "@/features/buddy/view-model/use-buddy-view-model";

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: vi.fn(),
    configurable: true,
  });
});

let recognitionInstance: MockRecognition | null = null;

class MockRecognition {
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
    recognitionInstance = this;
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
    isLoadingMessages: false,
    isSending: false,
    messages: [{ id: "1", conversationId: "conv-1", content: "Hello", role: "buddy" as const, timestamp: "8:00 PM" }],
    activeConversationId: "conv-1",
    error: null,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    loadConversations: vi.fn(),
    selectConversation: vi.fn(),
    createConversation: vi.fn(),
    renameConversation: vi.fn(),
    deleteConversation: vi.fn(),
    retryMessage: vi.fn(),
    sendFeedback: vi.fn(),
    conversations: [],
    searchConversations: vi.fn(),
    isLoadingList: false,
    selectedConversation: null,
    searchQuery: "",
    pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    isStreaming: false,
    streamingContent: "",
  };
}

describe("BuddyView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recognitionInstance = null;
    vi.unstubAllGlobals();
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
      recognitionInstance?.emitFinal("I feel tense");
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
});
