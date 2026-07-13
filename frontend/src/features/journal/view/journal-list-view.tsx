"use client";

import Link from "next/link";
import { PenLine } from "lucide-react";
import { useJournalListViewModel } from "../view-model/use-journal-list-view-model";
import { JournalFilters } from "../components/journal-filters";
import { JournalCard } from "../components/journal-card";
import { JournalEmptyState } from "../components/journal-empty-state";
import { EchoLoadingState } from "@/shared/components/feedback/echo-loading-state";
import { EchoErrorState } from "@/shared/components/feedback/echo-error-state";
import { EchoPageHeading } from "@/shared/components/data-display/echo-page-heading";

export function JournalListView() {
  const {
    entries,
    pagination,
    filters,
    isLoading,
    error,
    searchInput,
    isFiltered,
    setSearch,
    applySearch,
    setMoodFilter,
    setSort,
    setPage,
    resetFilters,
    retry,
  } = useJournalListViewModel();

  if (error && entries.length === 0) {
    return (
      <EchoErrorState
        title="Could not load journal entries"
        message={error}
        onRetry={retry}
      />
    );
  }

  return (
    <div>
      <EchoPageHeading
        title="Reflection history"
        description="Search entries, filter by mood, and keep distress summaries in context. ECHO is not a diagnostic tool."
        action={
          <Link href="/journal/new" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-subtle transition hover:bg-primary/90 focus-visible:ring-4 focus-visible:ring-ring/20">
            <PenLine className="h-4 w-4" aria-hidden="true" />
            New entry
          </Link>
        }
      />

      <div className="mt-6 space-y-6">
        <JournalFilters
          filters={filters}
          searchInput={searchInput}
          onSearchChange={setSearch}
          onSearchApply={applySearch}
          onMoodChange={setMoodFilter}
          onSortChange={setSort}
          onReset={resetFilters}
          isFiltered={isFiltered}
        />

        {isLoading ? (
          <EchoLoadingState variant="skeleton" count={6} />
        ) : entries.length === 0 ? (
          <JournalEmptyState isFiltered={isFiltered} />
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-3">
              {entries.map((entry) => (
                <JournalCard key={entry.id} entry={entry} />
              ))}
            </div>

            {pagination.totalPages > 1 && (
              <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setPage(page)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-medium outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20 ${
                      page === pagination.page
                        ? "bg-primary text-primary-foreground"
                        : "border border-border/70 bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
