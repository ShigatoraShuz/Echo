import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, it, expect, vi } from "vitest";
import { useJournalEditorViewModel } from "./use-journal-editor-view-model";
const api = vi.hoisted(() => ({ getDraft: vi.fn(), saveDraft: vi.fn() }));
const media = vi.hoisted(() => ({ list: vi.fn(), finalize: vi.fn(), upload: vi.fn(), remove: vi.fn() }));
vi.mock("@/services/journal/journal-service.factory", () => ({ getJournalService: () => api }));
vi.mock("@/services/journal/journal-media", () => ({ journalMedia: media }));
const draft = {
  id: "draft-1",
  title: "A reflection",
  body: "A private reflection",
  mood: "calm",
  emotions: [],
  tags: [],
  privacyStatus: "private",
  analysisConsent: false,
  updatedAt: "2026-09-06",
};
beforeEach(() => {
  vi.resetAllMocks();
  api.getDraft.mockResolvedValue({ success: true, data: draft });
  api.saveDraft.mockResolvedValue({ success: true, data: draft });
  media.list.mockResolvedValue([]);
});
it("resumes saved text before allowing edits", async () => {
  const { result } = renderHook(() => useJournalEditorViewModel());
  expect(result.current.ready).toBe(false);
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.body).toBe(draft.body);
  expect(media.list).toHaveBeenCalledWith("draft-1", true);
});
it("reuses finalization ID after response loss without recreating an active draft", async () => {
  const { result } = renderHook(() => useJournalEditorViewModel());
  await waitFor(() => expect(result.current.ready).toBe(true));
  media.finalize.mockRejectedValueOnce(Error("Response lost")).mockResolvedValueOnce({ id: "journal-1" });
  await act(async () => {
    await result.current.save();
  });
  expect(result.current.finalizing).toBe(true);
  act(() => result.current.setBody("must not overwrite a pending submission"));
  expect(result.current.body).toBe(draft.body);
  await act(async () => {
    await result.current.saveDraft();
    await result.current.save();
  });
  expect(api.saveDraft).toHaveBeenCalledTimes(1);
  expect(media.finalize.mock.calls).toEqual([["draft-1"], ["draft-1"]]);
  expect(result.current.savedEntry?.id).toBe("journal-1");
  expect(result.current.finalizing).toBe(false);
});
it("keeps editing disabled when draft ownership/read fails", async () => {
  api.getDraft.mockResolvedValue({ success: false, error: { message: "Draft unavailable" } });
  const { result } = renderHook(() => useJournalEditorViewModel());
  await waitFor(() => expect(result.current.error).toBe("Draft unavailable"));
  await act(async () => {
    await result.current.saveDraft();
  });
  expect(result.current.ready).toBe(false);
  expect(api.saveDraft).not.toHaveBeenCalled();
});
