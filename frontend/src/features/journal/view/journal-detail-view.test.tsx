import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { JournalDetailView } from "./journal-detail-view";
import { useJournalDetailViewModel } from "../view-model/use-journal-detail-view-model";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../view-model/use-journal-detail-view-model", () => ({ useJournalDetailViewModel: vi.fn() }));
vi.mock("../components/journal-analysis-panel", () => ({ JournalAnalysisPanel: () => null }));

const photoState = { addPhotos: vi.fn(), photoUploadError: "", uploadingPhotos: false };

describe("JournalDetailView", () => {
  it.each([
    ["PROCESSOR_DISABLED", "waiting_for_provider", /processing is unavailable in this environment/i],
    ["PROCESSING_FAILED", "failed", /failed result is not a low distress score/i],
  ] as const)("shows an actionable %s state without inventing a result", async (reason, status, text) => {
    const retry = vi.fn();
    vi.mocked(useJournalDetailViewModel).mockReturnValue({
      entry: { id: "entry-1", title: "Fictional reflection", body: "Fictional text", excerpt: "Fictional text",
        mood: "calm", emotions: [], tags: [], privacyStatus: "private", analysisConsent: true,
        riskScore: null, riskBand: null, summary: "", perspective: null,
        createdAt: "2026-10-12T08:00:00.000Z", updatedAt: "2026-10-12T08:00:00.000Z" },
      analysis: null, analysisAvailability: { journalId: "entry-1", jobId: "job", status, reason },
      isLoading: false, isDeleting: false, isExporting: false, showDeleteDialog: false, error: null, notFound: false,
      deleteEntry: vi.fn(), exportEntry: vi.fn(), openDeleteDialog: vi.fn(), retry,
      ...photoState,
    });
    render(<JournalDetailView id="entry-1" />);
    expect(screen.getByText(text)).toBeVisible();
    await userEvent.setup().click(screen.getByRole("button", { name: "Check analysis status" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByText(/low distress signal/i)).not.toBeInTheDocument();
  });
  it("keeps the entry open when deletion fails and navigates only after success", async () => {
    const deleteEntry = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useJournalDetailViewModel).mockReturnValue({
      entry: {
        id: "entry-1", title: "A quiet page", body: "A private thought", excerpt: "A private thought",
        mood: "calm", emotions: [], tags: [], privacyStatus: "private", analysisConsent: false,
        riskScore: null, riskBand: null, summary: "", perspective: null,
        createdAt: "2026-10-12T08:00:00.000Z", updatedAt: "2026-10-12T08:00:00.000Z",
      },
      analysis: null, analysisAvailability: null, isLoading: false, isDeleting: false, isExporting: false,
      showDeleteDialog: true, error: null, notFound: false,
      deleteEntry, exportEntry: vi.fn(), openDeleteDialog: vi.fn(), retry: vi.fn(),
      ...photoState,
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
    const addPhotos = vi.fn();
    const retry = vi.fn();
    vi.mocked(useJournalDetailViewModel).mockReturnValue({
      entry: {
        id: "entry-1", title: "A quiet page", body: "A private thought", excerpt: "A private thought",
        mood: "calm", emotions: [], tags: [], privacyStatus: "private", analysisConsent: false,
        riskScore: null, riskBand: null, summary: "", perspective: null,
        createdAt: "2026-10-12T08:00:00.000Z", updatedAt: "2026-10-12T08:00:00.000Z",
      },
      analysis: null, analysisAvailability: null, isLoading: false, isDeleting: false, isExporting: false,
      showDeleteDialog: false, error: null, notFound: false,
      deleteEntry: vi.fn(), exportEntry: vi.fn(), openDeleteDialog: vi.fn(), retry,
      ...photoState, addPhotos,
    });
    const user = userEvent.setup();
    render(<JournalDetailView id="entry-1" />);
    expect(screen.queryByLabelText("Reflection illustration")).not.toBeInTheDocument();
    expect(screen.getByText("Add your photos")).toBeVisible();
    await user.upload(screen.getByLabelText("Add photos to reflection"), new File(["image"], "moment.png", { type: "image/png" }));
    await waitFor(() => expect(addPhotos).toHaveBeenCalledWith([expect.any(File)]));
  });
});
