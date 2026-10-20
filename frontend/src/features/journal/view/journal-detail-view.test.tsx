import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { JournalDetailView } from "./journal-detail-view";
import { useJournalDetailViewModel } from "../view-model/use-journal-detail-view-model";

const push = vi.fn();
const uploadImage = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../view-model/use-journal-detail-view-model", () => ({ useJournalDetailViewModel: vi.fn() }));
vi.mock("../components/journal-analysis-panel", () => ({ JournalAnalysisPanel: () => null }));
vi.mock("@/services/journal/journal-service.factory", () => ({ getJournalService: () => ({ uploadImage }) }));

describe("JournalDetailView", () => {
  it("keeps the entry open when deletion fails and navigates only after success", async () => {
    const deleteEntry = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useJournalDetailViewModel).mockReturnValue({
      entry: {
        id: "entry-1", title: "A quiet page", body: "A private thought", excerpt: "A private thought",
        mood: "calm", emotions: [], tags: [], privacyStatus: "private", analysisConsent: false,
        riskScore: null, riskBand: null, summary: "", perspective: null,
        createdAt: "2026-10-12T08:00:00.000Z", updatedAt: "2026-10-12T08:00:00.000Z",
      },
      analysis: null, isLoading: false, isDeleting: false, isExporting: false,
      showDeleteDialog: true, error: null, notFound: false,
      deleteEntry, exportEntry: vi.fn(), openDeleteDialog: vi.fn(), retry: vi.fn(),
    });
    const user = userEvent.setup();
    render(<JournalDetailView id="entry-1" />);

    const confirmDelete = screen.getAllByRole("button", { name: "Delete" })[1];
    await user.click(confirmDelete);
    expect(push).not.toHaveBeenCalled();
    await user.click(confirmDelete);
    expect(push).toHaveBeenCalledWith("/journal");
  });

  it("uploads an added photo to the saved reflection and refreshes it", async () => {
    uploadImage.mockResolvedValue({ success: true, data: { id: "photo-1" } });
    const retry = vi.fn();
    vi.mocked(useJournalDetailViewModel).mockReturnValue({
      entry: {
        id: "entry-1", title: "A quiet page", body: "A private thought", excerpt: "A private thought",
        mood: "calm", emotions: [], tags: [], privacyStatus: "private", analysisConsent: false,
        riskScore: null, riskBand: null, summary: "", perspective: null,
        createdAt: "2026-10-12T08:00:00.000Z", updatedAt: "2026-10-12T08:00:00.000Z",
      },
      analysis: null, isLoading: false, isDeleting: false, isExporting: false,
      showDeleteDialog: false, error: null, notFound: false,
      deleteEntry: vi.fn(), exportEntry: vi.fn(), openDeleteDialog: vi.fn(), retry,
    });
    const user = userEvent.setup();
    render(<JournalDetailView id="entry-1" />);
    await user.upload(screen.getByLabelText("Add photos to reflection"), new File(["image"], "moment.png", { type: "image/png" }));
    await waitFor(() => expect(uploadImage).toHaveBeenCalledWith("entry-1", expect.any(String), expect.any(File)));
    expect(retry).toHaveBeenCalled();
  });
});
