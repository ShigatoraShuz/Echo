"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpen, CalendarDays, PenLine, Sparkles } from "lucide-react";
import { useJournalListViewModel } from "../view-model/use-journal-list-view-model";
import { JournalFilters } from "../components/journal-filters";
import { JournalCard } from "../components/journal-card";
import { JournalEmptyState } from "../components/journal-empty-state";
import { EchoLoadingState } from "@/shared/components/feedback/echo-loading-state";
import { EchoErrorState } from "@/shared/components/feedback/echo-error-state";
import { EchoMotionSurface } from "@/shared/components/ui/echo-motion-surface";
import journalLandscape from "../../../../assets/growth-doorway-hill.png";

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
      <EchoMotionSurface className="relative overflow-hidden rounded-[1.6rem] border border-border/65 bg-card p-5 shadow-subtle sm:p-7">
        <div className="relative z-10 max-w-xl">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Your private journal</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl">Pages to return to, at your pace.</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Keep small moments, honest thoughts, and the patterns you want to understand a little better.</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link href="/journal/new" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-subtle outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-primary/90 focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.97]"><PenLine className="h-4 w-4" aria-hidden="true" /> Open today&apos;s page</Link>
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" /> {entries.length} saved reflections</span>
          </div>
        </div>
        <Image src={journalLandscape} alt="A doorway on a quiet hillside" priority className="absolute inset-y-0 right-0 hidden h-full w-[38%] object-cover object-center opacity-75 [mask-image:linear-gradient(to_left,black_65%,transparent)] md:block" />
      </EchoMotionSurface>

      <div className="mt-6 space-y-6">
        <div className="flex items-end justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Reflection history</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.04em] text-foreground">Your saved pages</h2></div><BookOpen className="h-5 w-5 text-primary" aria-hidden="true" /></div>
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
            <div className="echo-card-motion-grid grid gap-5 lg:grid-cols-3">
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
