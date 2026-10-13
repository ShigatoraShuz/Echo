import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
  emotions: [],
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
      entries: [entry("first", "First page"), {
        ...entry("second", "Second page"),
        images: Array.from({ length: 6 }, (_, index) => ({ id: `image-${index}`, url: `https://example.com/image-${index}.jpg` })),
      }],
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
      setSort: vi.fn(),
      setPage: vi.fn(),
      deleteEntry: vi.fn(),
      resetFilters: vi.fn(),
      retry: vi.fn(),
    });
    const user = userEvent.setup();
    render(<JournalNotebookView />);

    expect(screen.getByRole("link", { name: /write reflection/i })).toHaveAttribute("href", "/journal/new");
    expect(screen.getByRole("link", { name: /resume a draft/i })).toHaveAttribute("href", "/journal/drafts");
    await user.click(screen.getByRole("button", { name: /second page/i }));
    expect(screen.getByRole("region", { name: "Selected reflection" })).toHaveTextContent("Words from Second page");
    expect(screen.getAllByRole("img", { name: /photo \d from this reflection/i })).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Open full page" })).toHaveAttribute("href", "/journal/second");
  });
});
