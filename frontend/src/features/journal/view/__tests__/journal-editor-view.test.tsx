import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { JournalEditorView } from "../journal-editor-view";
import { useJournalEditorViewModel } from "@/features/journal/view-model/use-journal-editor-view-model";
import { getJournalService } from "@/services/journal/journal-service.factory";

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => createElement("img", { alt: props.alt }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/services/journal/journal-service.factory", () => ({
  getJournalService: vi.fn(),
  resetJournalService: vi.fn(),
}));

vi.mock("@/features/journal/view-model/use-journal-editor-view-model", () => ({
  useJournalEditorViewModel: vi.fn(),
}));

vi.mock("@/shared/components/feedback/echo-inline-message", () => ({
  EchoInlineMessage: ({ message }: { message: string }) => <div>{message}</div>,
}));

function setupMock() {
  return {
    title: "",
    body: "",
    mood: "calm" as const,
    emotions: [],
    tags: [],
    analysisConsent: false,
    privacyStatus: "private" as const,
    wordCount: 0,
    charCount: 0,
    isSaving: false,
    autosaveStatus: "idle",
    error: null,
    fieldErrors: {},
    savedEntry: null,
    words: 0,
    setTitle: vi.fn(),
    setBody: vi.fn(),
    setMood: vi.fn(),
    setEmotions: vi.fn(),
    setTags: vi.fn(),
    setAnalysisConsent: vi.fn(),
    setPrivacyStatus: vi.fn(),
    save: vi.fn(),
    reset: vi.fn(),
    clearError: vi.fn(),
    retryAutosave: vi.fn(),
  };
}

describe("JournalEditorView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getJournalService).mockReturnValue({
      listEntries: vi.fn().mockResolvedValue({ success: true, data: { entries: [] } }),
    } as never);
  });

  it("wires textboxes, mood buttons, checkbox, and save", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    vi.mocked(useJournalEditorViewModel).mockReturnValue(mock as unknown as ReturnType<typeof useJournalEditorViewModel>);

    render(<JournalEditorView />);

    await user.type(screen.getByLabelText(/title/i), "Morning reflection");
    await user.type(screen.getByLabelText(/start writing/i), "I felt steady today.");
    await user.click(screen.getByRole("button", { name: /happy/i }));
    await user.click(screen.getByLabelText(/allow a reflective summary after saving/i));
    await user.click(screen.getByRole("button", { name: /save reflection/i }));

    expect(mock.setTitle).toHaveBeenCalled();
    expect(mock.setBody).toHaveBeenCalled();
    expect(mock.setMood).toHaveBeenCalledWith("happy");
    expect(mock.setAnalysisConsent).toHaveBeenCalled();
    expect(mock.save).toHaveBeenCalled();
  });
});
