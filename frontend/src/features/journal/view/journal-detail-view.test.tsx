import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { JournalDetailView } from "./journal-detail-view";
import { useJournalDetailViewModel } from "../view-model/use-journal-detail-view-model";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../view-model/use-journal-detail-view-model", () => ({ useJournalDetailViewModel: vi.fn() }));
vi.mock("../components/journal-analysis-panel", () => ({ JournalAnalysisPanel: () => null }));

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
});
