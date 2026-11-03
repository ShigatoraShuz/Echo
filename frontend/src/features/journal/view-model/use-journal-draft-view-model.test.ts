import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useJournalDraftViewModel } from "./use-journal-draft-view-model";

const service = vi.hoisted(() => ({ getDraft: vi.fn() }));
vi.mock("@/services/journal/journal-service.factory", () => ({ getJournalService: () => service }));

describe("journal draft view model", () => {
  beforeEach(() => service.getDraft.mockReset());

  it("offers retry after a failed read and then shows the saved draft", async () => {
    const draft = { title: "Private draft", body: "Still writing", updatedAt: "2026-11-03T00:00:00.000Z" };
    service.getDraft.mockResolvedValueOnce({ success: false, error: { message: "Temporary failure" } })
      .mockResolvedValueOnce({ success: true, data: draft });
    const { result } = renderHook(() => useJournalDraftViewModel());
    await waitFor(() => expect(result.current.error).toBe("Temporary failure"));
    await act(async () => result.current.retry());
    expect(result.current.draft).toEqual(draft);
    expect(result.current.error).toBe("");
    expect(result.current.loading).toBe(false);
  });

  it("does not let an older response replace a newer retry result", async () => {
    let finishFirst!: (value: unknown) => void;
    service.getDraft.mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve; }))
      .mockResolvedValueOnce({ success: true, data: { title: "Newer draft" } });
    const { result } = renderHook(() => useJournalDraftViewModel());
    await act(async () => result.current.retry());
    await act(async () => finishFirst({ success: true, data: { title: "Older draft" } }));
    expect(result.current.draft?.title).toBe("Newer draft");
  });
});
