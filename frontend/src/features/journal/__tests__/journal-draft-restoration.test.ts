import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJournalEditorViewModel } from "../view-model/use-journal-editor-view-model";
import type { JournalDraft } from "../model/journal.model";
const service = vi.hoisted(() => ({
  getDraft: vi.fn(),
  saveDraft: vi.fn(),
  createEntry: vi.fn(),
  attachDraftImages: vi.fn(),
  deleteDraft: vi.fn(),
}));
vi.mock("@/services/journal/journal-service.factory", () => ({ getJournalService: () => service }));
vi.mock("@/config/environment", () => ({ env: { enableAnalysisFixtures: false, apiBaseUrl: "/api/v1" } }));
vi.mock("@/infrastructure/api/supabase-auth-token-provider", () => ({ supabaseAuthTokenProvider: { getAccessToken: async () => "synthetic-token" } }));
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.clearAllMocks();
  service.attachDraftImages.mockResolvedValue({ success: true, data: { attached: 0 } });
});
describe("draft restoration", () => {
  it("keeps editing and submission blocked if the saved draft cannot be loaded", async () => {
    service.getDraft.mockResolvedValue({ success: false, error: { message: "Draft unavailable" } });
    const { result } = renderHook(() => useJournalEditorViewModel({resumeDraft:true}));
    await waitFor(() => expect(result.current.error).toBe("Draft unavailable"));
    act(() => result.current.setBody("Do not overwrite the remote draft"));
    await act(async () => result.current.save());
    expect(result.current.draftReady).toBe(false);
    expect(result.current.body).toBe("");
    expect(service.saveDraft).not.toHaveBeenCalled();
    expect(service.createEntry).not.toHaveBeenCalled();
  });
  it("restores content and reuses its submission identity when finalizing", async () => {
    const draft = {
      id: "current",
      title: "Saved title",
      body: "My saved reflection",
      mood: "calm",
      emotions: [],
      tags: [],
      privacyStatus: "private",
      analysisConsent: false,
      updatedAt: "2026-09-12T00:00:00Z",
      submissionKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    };
    service.getDraft.mockResolvedValue({ success: true, data: draft });
    service.saveDraft.mockResolvedValue({ success: true, data: draft });
    service.createEntry.mockResolvedValue({ success: true, data: { id: "saved-journal" } });
    service.deleteDraft.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useJournalEditorViewModel({resumeDraft:true}));
    await waitFor(() => expect(result.current.draftReady).toBe(true));
    expect(result.current.body).toBe(draft.body);
    await act(async () => result.current.save());
    expect(service.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ body: draft.body }),
      expect.objectContaining({ idempotencyKey: draft.submissionKey }),
    );
    expect(service.deleteDraft).toHaveBeenCalledWith(draft.submissionKey);
  });
  it("persists an intentionally cleared draft before leaving", async () => {
    service.getDraft.mockResolvedValue({ success: true, data: {
      id: "current", title: "Old title", body: "Old text", mood: "calm", emotions: [], tags: [],
      privacyStatus: "private", analysisConsent: false, updatedAt: "2026-10-13T00:00:00Z",
    } });
    service.saveDraft.mockImplementation(async (draft: JournalDraft) => ({ success: true, data: draft }));
    const { result } = renderHook(() => useJournalEditorViewModel({resumeDraft:true}));
    await waitFor(() => expect(result.current.draftReady).toBe(true));
    act(() => { result.current.setTitle(""); result.current.setBody(""); });
    await act(async () => expect(await result.current.saveDraftNow()).toBe(true));
    expect(service.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ title: "", body: "" }));
  });

  it("waits for an in-flight blur autosave before allowing navigation", async () => {
    service.getDraft.mockResolvedValue({ success: true, data: null });
    let finishSave!: (result: { success: true }) => void;
    service.saveDraft.mockReturnValue(new Promise((resolve) => { finishSave = resolve; }));
    const { result } = renderHook(() => useJournalEditorViewModel({resumeDraft:true}));
    await waitFor(() => expect(result.current.draftReady).toBe(true));
    act(() => result.current.setBody("A draft in progress"));

    await act(async () => {
      const blurSave = result.current.saveDraftNow();
      const linkSave = result.current.saveDraftNow();
      finishSave({ success: true });
      expect(await blurSave).toBe(true);
      expect(await linkSave).toBe(true);
    });
    expect(service.saveDraft).toHaveBeenCalledTimes(1);
  });

  it("keeps the saved draft available when attaching its photos fails", async () => {
    service.getDraft.mockResolvedValue({ success: true, data: {
      id: "current", title: "Photo page", body: "A saved thought", mood: "calm", emotions: [], tags: [],
      privacyStatus: "private", analysisConsent: false, updatedAt: "2026-10-16T00:00:00Z",
    } });
    service.saveDraft.mockResolvedValue({ success: true });
    service.createEntry.mockResolvedValue({ success: true, data: { id: "saved-journal" } });
    service.attachDraftImages
      .mockResolvedValueOnce({ success: false, error: { message: "Attachment failed" } })
      .mockResolvedValueOnce({ success: true, data: { attached: 2 } });
    service.deleteDraft.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useJournalEditorViewModel({resumeDraft:true}));
    await waitFor(() => expect(result.current.draftReady).toBe(true));

    await act(async () => result.current.save());
    expect(result.current.error).toContain("Attachment failed");
    await act(async () => result.current.save());

    expect(service.createEntry).toHaveBeenCalledTimes(1);
    expect(service.attachDraftImages).toHaveBeenCalledTimes(2);
    expect(service.deleteDraft).toHaveBeenCalledTimes(1);
  });
});

function savedAnalysisDraft() {
  const draft = { id: "current", title: "Synthetic test", body: "A fictional testing entry", emotions: [], tags: [], privacyStatus: "private", analysisConsent: true, updatedAt: "2026-11-06T00:00:00Z", submissionKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
  service.getDraft.mockResolvedValue({ success: true, data: draft });
  service.createEntry.mockResolvedValue({ success: true, data: { kind: "analysis", submission: { journalId: "saved-id", analysisJobId: "job-id", status: "queued", facialStatus: "queued" } } });
  service.deleteDraft.mockResolvedValue({ success: true });
  return draft;
}

it("reuses an unchanged persisted submission key without writing the same draft again", async () => {
  savedAnalysisDraft();
  const {result} = renderHook(() => useJournalEditorViewModel({resumeDraft:true}));
  await waitFor(() => expect(result.current.draftReady).toBe(true));
  await act(async () => result.current.save());
  expect(service.saveDraft).not.toHaveBeenCalled();
  expect(service.createEntry).toHaveBeenCalledTimes(1);
  expect(result.current.analysisSubmission?.journalId).toBe("saved-id");
});

it("shows confirmed analysis progress while face/photos finish concurrently, without deleting the draft early", async () => {
  savedAnalysisDraft();
  let finishFace!: (value: unknown) => void;
  let finishPhotos!: (value: unknown) => void;
  const face = vi.fn(() => new Promise(resolve => { finishFace = resolve; }));
  vi.stubGlobal("fetch", face);
  service.attachDraftImages.mockImplementationOnce(() => new Promise(resolve => { finishPhotos = resolve; }));
  const {result} = renderHook(() => useJournalEditorViewModel({resumeDraft:true}));
  await waitFor(() => expect(result.current.draftReady).toBe(true));
  let saving!: Promise<void>;
  act(() => { saving = result.current.save({requested: true, image: new Blob(["synthetic frame"])}); });
  await waitFor(() => expect(face).toHaveBeenCalledOnce());
  expect(service.attachDraftImages).toHaveBeenCalledWith("saved-id");
  expect(result.current.pendingSubmission?.journalId).toBe("saved-id");
  expect(result.current.isSaving).toBe(true);
  expect(result.current.analysisSubmission).toBeNull();
  expect(service.deleteDraft).not.toHaveBeenCalled();
  await act(async () => { finishFace({ok:true}); await Promise.resolve(); });
  expect(service.deleteDraft).not.toHaveBeenCalled();
  await act(async () => { finishPhotos({success:true,data:{attached:1}}); await saving; });
  expect(result.current.pendingSubmission).toBeNull();
  expect(result.current.analysisSubmission?.journalId).toBe("saved-id");
  expect(service.deleteDraft).toHaveBeenCalledOnce();
});

it("retries attachment failure using the accepted journal and already-saved face result", async () => {
  savedAnalysisDraft();
  const face = vi.fn().mockResolvedValue({ok:true}); vi.stubGlobal("fetch", face);
  service.attachDraftImages.mockResolvedValueOnce({success:false,error:{message:"Offline"}}).mockResolvedValueOnce({success:true,data:{attached:1}});
  const {result}=renderHook(() => useJournalEditorViewModel({resumeDraft:true}));
  await waitFor(() => expect(result.current.draftReady).toBe(true));
  await act(async () => result.current.save({requested:true,image:new Blob(["synthetic frame"])}));
  expect(result.current.error).toContain("Offline");
  expect(service.deleteDraft).not.toHaveBeenCalled();
  await act(async () => result.current.save({requested:true}));
  expect(service.createEntry).toHaveBeenCalledOnce();
  expect(face).toHaveBeenCalledOnce();
  expect(result.current.analysisSubmission?.journalId).toBe("saved-id");
});

it("retains the temporary frame for retry if face saving fails and never duplicates the journal", async () => {
  savedAnalysisDraft();
  const face=vi.fn().mockResolvedValueOnce({ok:false,json:async()=>({error:{code:"FACE_UNAVAILABLE"}})}).mockResolvedValueOnce({ok:true});
  vi.stubGlobal("fetch",face);
  const {result}=renderHook(() => useJournalEditorViewModel({resumeDraft:true}));
  await waitFor(() => expect(result.current.draftReady).toBe(true));
  const image=new Blob(["synthetic frame"]);
  await act(async () => result.current.save({requested:true,image}));
  expect(result.current.error).toContain("face analysis was not saved");
  expect(service.deleteDraft).not.toHaveBeenCalled();
  await act(async () => result.current.save({requested:true}));
  expect(service.createEntry).toHaveBeenCalledOnce();
  expect(face.mock.calls[1][1].body).toBe(image);
  expect(result.current.analysisSubmission?.journalId).toBe("saved-id");
});

it("persists a changed draft and fresh retry identity before creating the journal", async () => {
  const draft=savedAnalysisDraft();service.saveDraft.mockResolvedValue({success:true});
  const {result}=renderHook(()=>useJournalEditorViewModel({resumeDraft:true}));
  await waitFor(()=>expect(result.current.draftReady).toBe(true));
  act(()=>result.current.setBody("A changed fictional reflection"));
  await act(async()=>result.current.save());
  expect(service.saveDraft).toHaveBeenCalledOnce();
  const persisted=service.saveDraft.mock.calls[0][0];
  expect(persisted.submissionKey).not.toBe(draft.submissionKey);
  expect(service.createEntry).toHaveBeenCalledWith(expect.objectContaining({body:persisted.body}),expect.objectContaining({idempotencyKey:persisted.submissionKey}));
});


it("versions a stale blur snapshot separately from newer writing before publishing", async () => {
  const original = savedAnalysisDraft();
  const versions = new Map([[original.submissionKey, JSON.stringify([original.title, original.body])]]);
  service.saveDraft.mockImplementation(async draft => {
    const content = JSON.stringify([draft.title, draft.body]);
    if (versions.has(draft.submissionKey) && versions.get(draft.submissionKey) !== content)
      return {success:false,error:{message:"Retry identity reused for different writing"}};
    versions.set(draft.submissionKey, content);
    return {success:true,data:draft};
  });
  const {result} = renderHook(() => useJournalEditorViewModel({resumeDraft:true}));
  await waitFor(() => expect(result.current.draftReady).toBe(true));
  const staleBlur = result.current.saveDraftNow;
  act(() => result.current.setBody("Newer fictional reflection after focus changed"));
  await act(async () => { await staleBlur(true); });
  await act(async () => { await result.current.save(); });
  expect(result.current.error).toBeNull();
  expect(service.createEntry).toHaveBeenCalledOnce();
  const submittedKey = service.createEntry.mock.calls[0][1].idempotencyKey;
  expect(versions.get(submittedKey)).toBe(JSON.stringify([original.title,"Newer fictional reflection after focus changed"]));
  expect(result.current.analysisSubmission?.journalId).toBe("saved-id");
});
