import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useJournalDetailViewModel } from "./use-journal-detail-view-model";

const service = vi.hoisted(() => ({ getEntry: vi.fn(), getAnalysis: vi.fn(), getAnalysisAvailability: vi.fn(), uploadImage: vi.fn() }));
vi.mock("@/services/journal/journal-service.factory", () => ({ getJournalService: () => service }));

const entry = (id: string, consent = true) => ({ success: true, data: { id, analysisConsent: consent } });
const pending = { journalId: "one", jobId: "job", status: "waiting_for_provider", reason: "PROCESSOR_DISABLED" };

describe("Journal analysis availability and request isolation", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("loads a truthful pending reason only when consent exists and no result is saved", async () => {
    service.getEntry.mockResolvedValue(entry("one"));
    service.getAnalysis.mockResolvedValue({ success: true, data: null });
    service.getAnalysisAvailability.mockResolvedValue({ success: true, data: pending });
    const { result } = renderHook(() => useJournalDetailViewModel("one"));
    await waitFor(() => expect(result.current.analysisAvailability).toEqual(pending));
    expect(result.current.analysis).toBeNull();
  });

  it("does not request analysis or progress for a nonconsented entry", async () => {
    service.getEntry.mockResolvedValue(entry("one", false));
    const { result } = renderHook(() => useJournalDetailViewModel("one"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(service.getAnalysis).not.toHaveBeenCalled();
    expect(service.getAnalysisAvailability).not.toHaveBeenCalled();
  });

  it("rejects late result responses after switching entries", async () => {
    let resolveOld!: (value: unknown) => void;
    service.getEntry.mockImplementation((id: string) => Promise.resolve(entry(id, id === "one")));
    service.getAnalysis.mockReturnValue(new Promise(resolve => { resolveOld = resolve; }));
    const { result, rerender } = renderHook(({ id }) => useJournalDetailViewModel(id), { initialProps: { id: "one" } });
    await waitFor(() => expect(service.getAnalysis).toHaveBeenCalledWith("one"));
    rerender({ id: "two" });
    await waitFor(() => expect(result.current.entry?.id).toBe("two"));
    await act(async () => { resolveOld({ success: true, data: { entryId: "one", summary: "Fictional old result" } }); });
    expect(result.current.analysis).toBeNull();
    expect(result.current.analysisAvailability).toBeNull();
  });

  it("does not overwrite a newer progress response with an older request", async () => {
    let resolveOld!: (value: unknown) => void;
    service.getEntry.mockImplementation((id: string) => Promise.resolve(entry(id)));
    service.getAnalysis.mockResolvedValue({ success: true, data: null });
    service.getAnalysisAvailability.mockImplementation((id: string) => id === "one"
      ? new Promise(resolve => { resolveOld = resolve; })
      : Promise.resolve({ success: true, data: { ...pending, journalId: "two" } }));
    const { result, rerender } = renderHook(({ id }) => useJournalDetailViewModel(id), { initialProps: { id: "one" } });
    await waitFor(() => expect(service.getAnalysisAvailability).toHaveBeenCalledWith("one"));
    rerender({ id: "two" });
    await waitFor(() => expect(result.current.analysisAvailability?.journalId).toBe("two"));
    await act(async () => { resolveOld({ success: true, data: pending }); });
    expect(result.current.analysisAvailability?.journalId).toBe("two");
  });
  it("clears the entry and rejects late analysis after account invalidation", async () => {
    let resolveOld!: (value: unknown) => void;
    service.getEntry.mockResolvedValue(entry("one"));
    service.getAnalysis.mockReturnValue(new Promise(resolve => { resolveOld = resolve; }));
    const { result } = renderHook(() => useJournalDetailViewModel("one"));
    await waitFor(() => expect(service.getAnalysis).toHaveBeenCalled());
    act(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
    await act(async () => resolveOld({ success: true, data: { entryId: "one", summary: "Fictional old result" } }));
    expect(result.current.entry).toBeNull(); expect(result.current.analysis).toBeNull();
    act(() => window.dispatchEvent(new Event("echo:analysis-completed")));
    expect(service.getEntry).toHaveBeenCalledTimes(1);
  });
  it("reports a failed private result read and supports retry", async () => {
    service.getEntry.mockResolvedValue(entry("one"));
    service.getAnalysis.mockResolvedValueOnce({ success: false, error: { code: "UNKNOWN", message: "Analysis could not be loaded." } })
      .mockResolvedValue({ success: true, data: { entryId: "one", summary: "Fictional saved analysis" } });
    const { result } = renderHook(() => useJournalDetailViewModel("one"));
    await waitFor(() => expect(result.current.error).toBe("Analysis could not be loaded."));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.analysis?.summary).toBe("Fictional saved analysis"));
    expect(result.current.error).toBeNull();
  });

  it("validates photos before upload and reloads the saved entry after success", async () => {
    service.getEntry.mockResolvedValue(entry("one", false));
    service.uploadImage.mockResolvedValue({ success: true, data: { id: "photo-1" } });
    const { result } = renderHook(() => useJournalDetailViewModel("one"));
    await waitFor(() => expect(result.current.entry?.id).toBe("one"));

    await act(async () => result.current.addPhotos([new File(["not a photo"], "note.txt", { type: "text/plain" })]));
    expect(service.uploadImage).not.toHaveBeenCalled();
    expect(result.current.photoUploadError).toMatch(/JPEG, PNG, or WebP/);

    const photo = new File(["image"], "moment.png", { type: "image/png" });
    await act(async () => result.current.addPhotos([photo]));
    expect(service.uploadImage).toHaveBeenCalledWith("one", expect.any(String), photo);
    expect(service.getEntry).toHaveBeenCalledTimes(2);
    expect(result.current.photoUploadError).toBe("");
  });

});
