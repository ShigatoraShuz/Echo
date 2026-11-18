import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JournalNotebookView } from "./journal-notebook-view";
import { useJournalListViewModel } from "../view-model/use-journal-list-view-model";
import type { JournalEntry } from "../model/journal.model";

vi.mock("../view-model/use-journal-list-view-model", () => ({ useJournalListViewModel: vi.fn() }));

const entry = (id: string, title: string): JournalEntry => ({
  id,
  title,
  body: `Words from ${title}`,
  excerpt: `Words from ${title}`,
  mood: "calm",
  emotions: ["surprise"],
  tags: [],
  privacyStatus: "private",
  analysisConsent: false,
  riskScore: null,
  riskBand: null,
  summary: "",
  perspective: null,
  createdAt: "2026-10-12T08:00:00.000Z",
  updatedAt: "2026-10-12T08:00:00.000Z",
});

describe("JournalNotebookView", () => {
  it("opens a selected reflection while keeping the editor and draft links", async () => {
    vi.mocked(useJournalListViewModel).mockReturnValue({
      entries: [
        entry("first", "First page"),
        {
          ...entry("second", "Second page"),
          images: Array.from({ length: 6 }, (_, index) => ({
            id: `image-${index}`,
            url: `https://example.com/image-${index}.jpg`,
          })),
        },
      ],
      pagination: { page: 1, pageSize: 9, totalItems: 2, totalPages: 1 },
      filters: { query: "", mood: null, dateFrom: null, dateTo: null, sort: "newest" },
      isLoading: false,
      error: null,
      searchInput: "",
      isFiltered: false,
      setSearch: vi.fn(),
      applySearch: vi.fn(),
      setFilters: vi.fn(),
      setMoodFilter: vi.fn(),
      setEmotionFilter: vi.fn(),
      setSort: vi.fn(),
      setPage: vi.fn(),
      deleteEntry: vi.fn(),
      resetFilters: vi.fn(),
      retry: vi.fn(),
    });
    const user = userEvent.setup();
    render(<JournalNotebookView />);
    for(const name of ['joy','trust','fear','surprise','sadness','disgust','anger','anticipation'])expect(screen.getByRole('button',{name})).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'calm'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'neutral'})).not.toBeInTheDocument();


    await user.click(screen.getByRole("button", { name: "surprise" }));
    expect(vi.mocked(useJournalListViewModel).mock.results[0].value.setEmotionFilter).toHaveBeenCalledWith("surprise");
    expect(screen.getAllByText("surprise").length).toBeGreaterThan(1);
    expect(screen.queryByRole("button", { name: "Happy" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "joy" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "excitement" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "More emotions" }), "excitement");
    expect(vi.mocked(useJournalListViewModel).mock.results[0].value.setEmotionFilter).toHaveBeenCalledWith("excitement");
    await user.click(screen.getByRole("button", { name: "All entries" }));
    expect(vi.mocked(useJournalListViewModel).mock.results[0].value.setEmotionFilter).toHaveBeenCalledWith(null);

    expect(screen.getByRole("link", { name: /write reflection/i })).toHaveAttribute("href", "/journal/new");
    expect(screen.getByRole("link", { name: /resume a draft/i })).toHaveAttribute("href", "/journal/drafts");
    expect(screen.getByRole("link", { name: /second page/i })).toHaveAttribute("href", "/journal/second");
    expect(screen.getByRole("img", { name: "Preview photo from Second page" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /second page/i }));
    expect(screen.getByRole("region", { name: "Selected reflection" })).toHaveTextContent("Words from Second page");
    expect(screen.getAllByRole("img", { name: /photo \d from this reflection/i })).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Open full page" })).toHaveAttribute("href", "/journal/second");
    const remove = vi.mocked(useJournalListViewModel).mock.results[0].value.deleteEntry;
    let finishDelete!: (success: boolean) => void;
    remove.mockResolvedValueOnce(false).mockImplementationOnce(() => new Promise<boolean>(resolve => { finishDelete = resolve; }));
    await user.click(screen.getByRole("button", { name: "Delete journal" }));
    let dialog = screen.getByRole("dialog", { name: "Delete entry" });
    expect(dialog).toHaveTextContent("Second page");
    expect(dialog).toHaveTextContent("This action cannot be undone");
    expect(remove).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete journal" }));
    dialog = screen.getByRole("dialog", { name: "Delete entry" });
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Could not delete this journal");
    expect(remove).toHaveBeenCalledWith("second");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(within(dialog).getByRole("button", { name: "Deleting..." })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(dialog).toBeVisible();
    expect(remove).toHaveBeenCalledTimes(2);
    await act(async () => finishDelete(true));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

  });
});
