import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
vi.mock("@/config/environment", () => ({ env: { enableAnalysisFixtures: false } }));
beforeEach(() => {
  vi.clearAllMocks();
  service.attachDraftImages.mockResolvedValue({ success: true, data: { attached: 0 } });
});
describe("draft restoration", () => {
  it("keeps editing and submission blocked if the saved draft cannot be loaded", async () => {
    service.getDraft.mockResolvedValue({ success: false, error: { message: "Draft unavailable" } });
    const { result } = renderHook(() => useJournalEditorViewModel());
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
    const { result } = renderHook(() => useJournalEditorViewModel());
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
    const { result } = renderHook(() => useJournalEditorViewModel());
    await waitFor(() => expect(result.current.draftReady).toBe(true));
    act(() => { result.current.setTitle(""); result.current.setBody(""); });
    await act(async () => expect(await result.current.saveDraftNow()).toBe(true));
    expect(service.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ title: "", body: "" }));
  });

  it("waits for an in-flight blur autosave before allowing navigation", async () => {
    service.getDraft.mockResolvedValue({ success: true, data: null });
    let finishSave!: (result: { success: true }) => void;
    service.saveDraft.mockReturnValue(new Promise((resolve) => { finishSave = resolve; }));
    const { result } = renderHook(() => useJournalEditorViewModel());
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
    const { result } = renderHook(() => useJournalEditorViewModel());
    await waitFor(() => expect(result.current.draftReady).toBe(true));

    await act(async () => result.current.save());
    expect(result.current.error).toContain("Attachment failed");
    await act(async () => result.current.save());

    expect(service.createEntry).toHaveBeenCalledTimes(1);
    expect(service.attachDraftImages).toHaveBeenCalledTimes(2);
    expect(service.deleteDraft).toHaveBeenCalledTimes(1);
  });
});
