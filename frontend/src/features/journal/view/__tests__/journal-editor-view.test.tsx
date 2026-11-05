import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JournalEditorView } from "../journal-editor-view";
import { useJournalEditorViewModel } from "@/features/journal/view-model/use-journal-editor-view-model";
import { getJournalService } from "@/services/journal/journal-service.factory";

vi.mock("@/services/settings", () => ({
  settingsService: {
    get: async () => ({ privacy: { facialAnalysisEnabled: false, journalAiAnalysisEnabled: false } }),
  },
}));
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
vi.mock("@/features/journal/view-model/use-journal-detail-view-model", () => ({
  useJournalDetailViewModel: () => ({ analysis: null, analysisAvailability: null, retry: vi.fn() }),
}));
vi.mock("@/features/journal/components/analysis-status-experience", () => ({
  AnalysisStatusExperience: () => <div>Live model progress</div>,
}));

vi.mock("@/shared/components/feedback/echo-inline-message", () => ({
  EchoInlineMessage: ({ message }: { message: string }) => <div>{message}</div>,
}));

function setupMock() {
  return {
    draftReady: true,
    previousDraft:null,discardPreviousDraft:vi.fn().mockResolvedValue(true),shouldRestorePhotos:false,editorGeneration:0,
    analysisSubmission:null,fixture:'standard_low_distress' as const,setFixture:vi.fn(),
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
  it("shows saved analysis inline without navigating or replacing the workspace", async () => {
    const mock = { ...setupMock(), analysisConsent: true, title: "Saved writing", body: "Saved body", analysisSubmission: null as unknown };
    vi.mocked(useJournalEditorViewModel).mockReturnValue(mock as unknown as ReturnType<typeof useJournalEditorViewModel>);
    const view = render(<JournalEditorView />);
    const workspace = screen.getByRole("complementary", { name: "Journal analysis workspace" });
    mock.analysisSubmission = { journalId: "saved-id", analysisJobId: "job-id", status: "queued", facialStatus: "not_requested" };
    vi.mocked(useJournalEditorViewModel).mockReturnValue(mock as unknown as ReturnType<typeof useJournalEditorViewModel>);
    view.rerender(<JournalEditorView />);
    expect(screen.getByText("Live model progress")).toBeVisible();
    expect(screen.getByRole("complementary", { name: "Journal analysis workspace" })).toBe(workspace);
    expect(screen.getByLabelText("Start writing", { exact: true })).toHaveAttribute("readonly");
    expect(screen.getByRole("link", { name: "Open saved reflection" })).toHaveAttribute("href", "/journal/saved-id");
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
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

  it("wires writing and save without mood choices with privacy-controlled automatic analysis", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    vi.mocked(useJournalEditorViewModel).mockReturnValue(
      mock as unknown as ReturnType<typeof useJournalEditorViewModel>,
    );

    render(<JournalEditorView />);

    await waitFor(() => expect(screen.getByRole("button", { name: /save reflection/i })).toBeEnabled());

    await user.type(screen.getByLabelText(/title/i), "Morning reflection");
    await user.type(screen.getByLabelText(/start writing/i), "I felt steady today.");
    expect(screen.queryByRole("button", { name: /happy/i })).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Journal analysis workspace" })).toBeVisible();
    expect(screen.queryByText("More options")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tags (optional)")).toBeVisible();
    expect(screen.queryByLabelText(/allow a reflective summary after saving/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Journal analysis is off/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save reflection/i }));

    expect(mock.setTitle).toHaveBeenCalled();
    expect(mock.setBody).toHaveBeenCalled();
    expect(mock.setMood).not.toHaveBeenCalled();

    expect(mock.save).toHaveBeenCalled();
  });

  it("does not render the removed prompt and privacy notice cards", () => {
    const mock = setupMock();
    vi.mocked(useJournalEditorViewModel).mockReturnValue(
      mock as unknown as ReturnType<typeof useJournalEditorViewModel>,
    );

    render(<JournalEditorView />);

    expect(screen.queryByText(/a prompt, if it helps/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/echo is private by design/i)).not.toBeInTheDocument();
  });

  it("saves pending writing before returning to the overview", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    vi.mocked(useJournalEditorViewModel).mockReturnValue(
      mock as unknown as ReturnType<typeof useJournalEditorViewModel>,
    );
    render(<JournalEditorView />);
    await user.click(screen.getByRole("link", { name: /all reflections/i }));
    expect(mock.saveDraftNow).toHaveBeenCalledOnce();
  });

  it("protects selected photos when a sidebar link would leave the editor", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    vi.mocked(useJournalEditorViewModel).mockReturnValue(
      mock as unknown as ReturnType<typeof useJournalEditorViewModel>,
    );
    render(
      <>
        <JournalEditorView />
        <a href="/dashboard">Dashboard</a>
      </>,
    );
    await waitFor(() => expect(screen.getByLabelText("Upload journal photos")).toBeEnabled());
    uploadDraftImage.mockReturnValue(new Promise(() => undefined));
    await user.upload(
      screen.getByLabelText("Upload journal photos"),
      new File(["photo"], "moment.png", { type: "image/png" }),
    );
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
    vi.mocked(useJournalEditorViewModel).mockReturnValue(
      mock as unknown as ReturnType<typeof useJournalEditorViewModel>,
    );
    render(<JournalEditorView />);
    await waitFor(() => expect(screen.getByLabelText("Upload journal photos")).toBeEnabled());
    uploadDraftImage.mockReturnValue(new Promise(() => undefined));
    await user.upload(
      screen.getByLabelText("Upload journal photos"),
      new File(["photo"], "moment.png", { type: "image/png" }),
    );
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
    vi.mocked(useJournalEditorViewModel).mockReturnValue(
      mock as unknown as ReturnType<typeof useJournalEditorViewModel>,
    );
    render(<JournalEditorView />);
    await waitFor(() => expect(screen.getByLabelText("Upload journal photos")).toBeEnabled());
    uploadDraftImage.mockReturnValue(new Promise(() => undefined));
    await user.upload(
      screen.getByLabelText("Upload journal photos"),
      new File(["photo"], "moment.png", { type: "image/png" }),
    );
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
    vi.mocked(useJournalEditorViewModel).mockReturnValue(
      mock as unknown as ReturnType<typeof useJournalEditorViewModel>,
    );
    uploadDraftImage
      .mockResolvedValueOnce({ success: false, error: { message: "Upload unavailable" } })
      .mockResolvedValue({ success: true, data: { id: "saved-photo" } });
    const page = render(<JournalEditorView />);
    await waitFor(() => expect(screen.getByLabelText("Upload journal photos")).toBeEnabled());
    await user.upload(
      screen.getByLabelText("Upload journal photos"),
      new File(["photo"], "moment.png", { type: "image/png" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Upload unavailable");
    expect(screen.getByRole("button", { name: /save reflection/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry moment.png" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /save reflection/i })).toBeEnabled());
    const savedId = uploadDraftImage.mock.calls[0][0] as string;
    expect(uploadDraftImage.mock.calls[1][0]).toBe(savedId);
    page.unmount();

    listDraftImages.mockResolvedValue({
      success: true,
      data: [{ id: savedId, url: "https://storage.example.test/signed-photo" }],
    });
    vi.mocked(useJournalEditorViewModel).mockReturnValue({...setupMock(),shouldRestorePhotos:true} as ReturnType<typeof useJournalEditorViewModel>);
    render(<JournalEditorView resumeDraft/>);
    expect(await screen.findByRole("img", { name: "Draft photo 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save reflection/i })).toBeEnabled();
  });

it('same-route New action saves current writing and requests a fresh editor key',async()=>{
 const user=userEvent.setup();const mock=setupMock();vi.mocked(useJournalEditorViewModel).mockReturnValue(mock as ReturnType<typeof useJournalEditorViewModel>);
 const oldUrl=window.location.href;window.history.replaceState({},'', '/journal/new');
 const link=document.createElement('a');link.href='/journal/new';link.textContent='New reflection action';document.body.appendChild(link);
 try{render(<JournalEditorView/>);await user.click(link);await waitFor(()=>expect(mock.saveDraftNow).toHaveBeenCalled());expect(replace).toHaveBeenCalledWith(expect.stringMatching(/^\/journal\/new\?fresh=/));}
 finally{link.remove();window.history.replaceState({},'',oldUrl);}
});

it('New does not load prior saved draft photos',async()=>{
 const mock=setupMock();vi.mocked(useJournalEditorViewModel).mockReturnValue(mock as ReturnType<typeof useJournalEditorViewModel>);
 listDraftImages.mockClear();render(<JournalEditorView/>);await waitFor(()=>expect(screen.getByRole('button',{name:/save reflection/i})).toBeInTheDocument());expect(listDraftImages).not.toHaveBeenCalled();
});

it('leaving during draft reservation prevents a late photo upload',async()=>{
 const user=userEvent.setup();const mock=setupMock();let finish!:(v:boolean)=>void;
 mock.saveDraftNow.mockImplementation(()=>new Promise(r=>finish=r));
 vi.mocked(useJournalEditorViewModel).mockReturnValue(mock as ReturnType<typeof useJournalEditorViewModel>);
 const page=render(<JournalEditorView/>);await waitFor(()=>expect(screen.getByLabelText('Upload journal photos')).toBeEnabled());
 await user.upload(screen.getByLabelText('Upload journal photos'),new File(['photo'],'late.png',{type:'image/png'}));
 expect(mock.saveDraftNow).toHaveBeenCalled();page.unmount();
 await act(async()=>{finish(true);await Promise.resolve();});
 expect(uploadDraftImage).not.toHaveBeenCalled();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:journal-photo');
});
it('late restored photos cannot refill a freshly reset editor',async()=>{
 const mock={...setupMock(),shouldRestorePhotos:true};let finish!:(v:unknown)=>void;
 listDraftImages.mockImplementationOnce(()=>new Promise(r=>finish=r));
 vi.mocked(useJournalEditorViewModel).mockReturnValue(mock as ReturnType<typeof useJournalEditorViewModel>);
 const page=render(<JournalEditorView resumeDraft/>);await waitFor(()=>expect(listDraftImages).toHaveBeenCalledTimes(1));
 mock.shouldRestorePhotos=false;mock.editorGeneration=1;
 vi.mocked(useJournalEditorViewModel).mockReturnValue({...mock} as ReturnType<typeof useJournalEditorViewModel>);page.rerender(<JournalEditorView/>);
 await act(async()=>{finish({success:true,data:[{id:'late',url:'https://storage.example.test/old-photo'}]});await Promise.resolve();});
 expect(screen.queryByRole('img',{name:'Draft photo 1'})).not.toBeInTheDocument();
});
});
