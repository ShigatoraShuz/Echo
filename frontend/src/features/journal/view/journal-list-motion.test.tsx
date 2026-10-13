import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DefaultJournalFilters } from "../model/journal.model";
import { JournalListView } from "./journal-list-view";

const state = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../view-model/use-journal-list-view-model", () => ({ useJournalListViewModel: () => state.current }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("../components/journal-filters", () => ({ JournalFilters: () => null }));
vi.mock("../components/journal-empty-state", () => ({ JournalEmptyState: ({ isFiltered }: { isFiltered: boolean }) => <p>{isFiltered ? "Filtered empty" : "All empty"}</p> }));
vi.mock("@/shared/components/feedback/echo-loading-state", () => ({ EchoLoadingState: () => <p>Loading entries</p> }));

describe("journal content transition", () => {
  it("keeps loading and filtered empty states accurate as filters change", () => {
    state.current = {
      entries: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
      filters: DefaultJournalFilters,
      isLoading: true,
      error: null,
      searchInput: "",
      isFiltered: false,
      setSearch: vi.fn(), applySearch: vi.fn(), setMoodFilter: vi.fn(), setSort: vi.fn(), setPage: vi.fn(), resetFilters: vi.fn(), retry: vi.fn(),
    };
    const { container, rerender } = render(<JournalListView />);
    const loadingContent = container.querySelector(".echo-member-content-swap");
    expect(screen.getByText("Loading entries")).toBeInTheDocument();

    state.current = { ...state.current, isLoading: false, isFiltered: true, filters: { ...DefaultJournalFilters, query: "unmatched" } };
    rerender(<JournalListView />);
    expect(screen.getByText("Filtered empty")).toBeInTheDocument();
    expect(container.querySelector(".echo-member-content-swap")).not.toBe(loadingContent);
  });
});
