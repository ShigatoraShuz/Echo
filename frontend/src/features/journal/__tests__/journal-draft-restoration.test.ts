import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useJournalEditorViewModel } from "../view-model/use-journal-editor-view-model";
const service = vi.hoisted(() => ({
  getDraft: vi.fn(),
  saveDraft: vi.fn(),
  createEntry: vi.fn(),
  deleteDraft: vi.fn(),
}));
vi.mock("@/services/journal/journal-service.factory", () => ({ getJournalService: () => service }));
vi.mock("@/config/environment", () => ({ env: { enableAnalysisFixtures: false } }));
beforeEach(() => vi.clearAllMocks());
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
});
