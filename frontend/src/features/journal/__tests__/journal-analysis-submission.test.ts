import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJournalEditorViewModel } from "../view-model/use-journal-editor-view-model";

const service = vi.hoisted(() => ({ createEntry: vi.fn(), saveDraft: vi.fn(), deleteDraft: vi.fn() }));
vi.mock("@/services/journal/journal-service.factory", () => ({ getJournalService: () => service }));
vi.mock("@/config/environment", () => ({ env: { enableAnalysisFixtures: false } }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  service.createEntry.mockResolvedValue({
    success: false,
    error: { code: "FORBIDDEN", message: "Review the current policies." },
  });
  service.saveDraft.mockResolvedValue({ success: true, data: null });
  service.deleteDraft.mockResolvedValue({ success: true });
});
afterEach(() => vi.useRealTimers());

function editor() {
  const hook = renderHook(() => useJournalEditorViewModel());
  act(() => {
    hook.result.current.setTitle("Encrypted title");
    hook.result.current.setBody("My private reflection.");
    hook.result.current.setAnalysisConsent(true);
  });
  return hook;
}
describe("journal submission retry contract", () => {
  it("preserves draft and the same key through unchanged gate retries", async () => {
    const { result } = editor();
    await act(async () => {
      await result.current.save();
    });
    await act(async () => {
      await result.current.save();
    });
    expect(service.createEntry.mock.calls[0][1].idempotencyKey).toBe(
      service.createEntry.mock.calls[1][1].idempotencyKey,
    );
    expect(result.current.title).toBe("Encrypted title");
    expect(result.current.body).toBe("My private reflection.");
    expect(service.deleteDraft).not.toHaveBeenCalled();
    expect(result.current.analysisSubmission).toBeNull();
  });
  it("rotates the key when the user explicitly turns analysis off", async () => {
    const { result } = editor();
    await act(async () => {
      await result.current.save();
    });
    act(() => result.current.setAnalysisConsent(false));
    await act(async () => {
      await result.current.save();
    });
    expect(service.createEntry.mock.calls[0][1].idempotencyKey).not.toBe(
      service.createEntry.mock.calls[1][1].idempotencyKey,
    );
    expect(service.createEntry.mock.calls[1][0].analysisConsent).toBe(false);
  });
  it("rotates the key after content changes", async () => {
    const { result } = editor();
    await act(async () => {
      await result.current.save();
    });
    act(() => result.current.setBody("A changed request."));
    await act(async () => {
      await result.current.save();
    });
    expect(service.createEntry.mock.calls[0][1].idempotencyKey).not.toBe(
      service.createEntry.mock.calls[1][1].idempotencyKey,
    );
  });
  it("opens the status experience only after an analysis acceptance", async () => {
    const submission = {
      journalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      analysisJobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "waiting_for_provider",
    };
    service.createEntry.mockResolvedValue({ success: true, data: { kind: "analysis", submission } });
    const listener = vi.fn();
    window.addEventListener("echo:analysis-submitted", listener);
    const { result } = editor();
    expect(listener).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.save();
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(result.current.analysisSubmission).toEqual(submission);
    expect(service.deleteDraft).toHaveBeenCalledTimes(1);
    window.removeEventListener("echo:analysis-submitted", listener);
  });
});
