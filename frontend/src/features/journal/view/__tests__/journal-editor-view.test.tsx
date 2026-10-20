import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JournalEditorView } from "../journal-editor-view";
import { useJournalEditorViewModel } from "@/features/journal/view-model/use-journal-editor-view-model";
import { getJournalService } from "@/services/journal/journal-service.factory";

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

const push = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
const uploadDraftImage = vi.hoisted(() => vi.fn());
const listDraftImages = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
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
    draftReady: true,
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
    saveDraftNow: vi.fn().mockResolvedValue(true),
  };
}

describe("JournalEditorView", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => "blob:journal-photo");
    URL.revokeObjectURL = vi.fn();
    uploadDraftImage.mockResolvedValue({ success: true, data: { id: "saved-photo" } });
    listDraftImages.mockResolvedValue({ success: true, data: [] });
    vi.mocked(getJournalService).mockReturnValue({
      listEntries: vi.fn().mockResolvedValue({ success: true, data: { entries: [] } }),
      uploadDraftImage,
      listDraftImages,
      removeDraftImage: vi.fn().mockResolvedValue({ success: true }),
    } as never);
  });

  afterAll(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("wires textboxes, mood buttons, checkbox, and save", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    vi.mocked(useJournalEditorViewModel).mockReturnValue(mock as unknown as ReturnType<typeof useJournalEditorViewModel>);

    render(<JournalEditorView />);

    await waitFor(() => expect(screen.getByRole("button", { name: /save reflection/i })).toBeEnabled());

    await user.type(screen.getByLabelText(/title/i), "Morning reflection");
    await user.type(screen.getByLabelText(/start writing/i), "I felt steady today.");
    await user.click(screen.getByRole("button", { name: /happy/i }));
    await user.click(screen.getByText("More options"));
    await user.click(screen.getByLabelText(/allow a reflective summary after saving/i));
    await user.click(screen.getByRole("button", { name: /save reflection/i }));

    expect(mock.setTitle).toHaveBeenCalled();
    expect(mock.setBody).toHaveBeenCalled();
    expect(mock.setMood).toHaveBeenCalledWith("happy");
    expect(mock.setAnalysisConsent).toHaveBeenCalled();
    expect(mock.save).toHaveBeenCalled();
  });

  it("does not render the removed prompt and privacy notice cards", () => {
    const mock = setupMock();
    vi.mocked(useJournalEditorViewModel).mockReturnValue(mock as unknown as ReturnType<typeof useJournalEditorViewModel>);

    render(<JournalEditorView />);

    expect(screen.queryByText(/a prompt, if it helps/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/echo is private by design/i)).not.toBeInTheDocument();
  });

  it("saves pending writing before returning to the overview", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    vi.mocked(useJournalEditorViewModel).mockReturnValue(mock as unknown as ReturnType<typeof useJournalEditorViewModel>);
    render(<JournalEditorView />);
    await user.click(screen.getByRole("link", { name: /all reflections/i }));
    expect(mock.saveDraftNow).toHaveBeenCalledOnce();
  });

  it("protects selected photos when a sidebar link would leave the editor", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    vi.mocked(useJournalEditorViewModel).mockReturnValue(mock as unknown as ReturnType<typeof useJournalEditorViewModel>);
    render(<><JournalEditorView /><a href="/dashboard">Dashboard</a></>);
    await waitFor(() => expect(screen.getByLabelText("Upload journal photos")).toBeEnabled());
    uploadDraftImage.mockReturnValue(new Promise(() => undefined));
    await user.upload(screen.getByLabelText("Upload journal photos"), new File(["photo"], "moment.png", { type: "image/png" }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);

    await user.click(screen.getByRole("link", { name: "Dashboard" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(mock.saveDraftNow).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByRole("link", { name: "Dashboard" }));
    expect(mock.saveDraftNow).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledWith("/dashboard");
    confirm.mockRestore();
  });

  it("keeps selected photos after cancelling browser Back and saves writing before leaving", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    vi.mocked(useJournalEditorViewModel).mockReturnValue(mock as unknown as ReturnType<typeof useJournalEditorViewModel>);
    render(<JournalEditorView />);
    await waitFor(() => expect(screen.getByLabelText("Upload journal photos")).toBeEnabled());
    uploadDraftImage.mockReturnValue(new Promise(() => undefined));
    await user.upload(screen.getByLabelText("Upload journal photos"), new File(["photo"], "moment.png", { type: "image/png" }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});

    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(confirm).toHaveBeenCalledOnce();
    expect(mock.saveDraftNow).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();

    window.dispatchEvent(new PopStateEvent("popstate"));
    await vi.waitFor(() => expect(mock.saveDraftNow).toHaveBeenCalledTimes(2));
    expect(back).toHaveBeenCalledOnce();

    back.mockRestore();
    confirm.mockRestore();
  });

  it("keeps the editor open if saving the draft fails after browser Back", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    mock.saveDraftNow.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error("offline"));
    vi.mocked(useJournalEditorViewModel).mockReturnValue(mock as unknown as ReturnType<typeof useJournalEditorViewModel>);
    render(<JournalEditorView />);
    await waitFor(() => expect(screen.getByLabelText("Upload journal photos")).toBeEnabled());
    uploadDraftImage.mockReturnValue(new Promise(() => undefined));
    await user.upload(screen.getByLabelText("Upload journal photos"), new File(["photo"], "moment.png", { type: "image/png" }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your draft could not be saved");
    expect(back).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "moment.png" })).toBeInTheDocument();
    back.mockRestore();
    confirm.mockRestore();
  });

  it("retries a failed photo upload and restores the saved photo after reopening", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    vi.mocked(useJournalEditorViewModel).mockReturnValue(mock as unknown as ReturnType<typeof useJournalEditorViewModel>);
    uploadDraftImage.mockResolvedValueOnce({ success: false, error: { message: "Upload unavailable" } })
      .mockResolvedValue({ success: true, data: { id: "saved-photo" } });
    const page = render(<JournalEditorView />);
    await waitFor(() => expect(screen.getByLabelText("Upload journal photos")).toBeEnabled());
    await user.upload(screen.getByLabelText("Upload journal photos"), new File(["photo"], "moment.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Upload unavailable");
    expect(screen.getByRole("button", { name: /save reflection/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry moment.png" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /save reflection/i })).toBeEnabled());
    const savedId = uploadDraftImage.mock.calls[0][0] as string;
    expect(uploadDraftImage.mock.calls[1][0]).toBe(savedId);
    page.unmount();

    listDraftImages.mockResolvedValue({ success: true, data: [{ id: savedId, url: "https://storage.example.test/signed-photo" }] });
    render(<JournalEditorView />);
    expect(await screen.findByRole("img", { name: "Draft photo 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save reflection/i })).toBeEnabled();
  });
});
