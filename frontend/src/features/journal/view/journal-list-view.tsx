"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  LayoutGrid,
  ListTree,
  PenLine,
} from "lucide-react";
import { useJournalListViewModel } from "../view-model/use-journal-list-view-model";
import { JournalFilters } from "../components/journal-filters";
import { JournalCard } from "../components/journal-card";
import { JournalTimelineEntry } from "../components/journal-timeline-entry";
import { JournalEmptyState } from "../components/journal-empty-state";
import { EchoLoadingState } from "@/shared/components/feedback/echo-loading-state";
import { EchoErrorState } from "@/shared/components/feedback/echo-error-state";
import { EchoMotionSurface } from "@/shared/components/ui/echo-motion-surface";
import { formatJournalDate } from "../utils/journal-formatters";
import journalLandscape from "../../../../assets/growth-doorway-hill.png";

type JournalViewMode = "timeline" | "grid";

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

  const [viewMode, setViewMode] = useState<JournalViewMode>("grid");

  // Group entries by Month Year (e.g. "August 2026") for the timeline view
  const groupedTimelineEntries = useMemo(() => {
    const groups: Array<{ monthKey: string; items: typeof entries }> = [];
    const map = new Map<string, typeof entries>();

    for (const entry of entries) {
      const { monthYearKey } = formatJournalDate(entry.createdAt);
      if (!map.has(monthYearKey)) {
        map.set(monthYearKey, []);
        groups.push({ monthKey: monthYearKey, items: map.get(monthYearKey)! });
      }
      map.get(monthYearKey)!.push(entry);
    }

    return groups;
  }, [entries]);

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
    <div className="flex flex-col gap-5 [font-family:var(--font-echo-sans)] sm:gap-6">
      <Link href="/journal/drafts" className="order-2 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--landing-primary)] underline-offset-4 hover:underline sm:order-1 sm:min-h-0 sm:self-start sm:rounded-full sm:border sm:border-primary/20 sm:bg-card sm:px-4 sm:py-2 sm:no-underline">Unfinished pages · Resume a draft</Link>
      {/* ── Top Hero Banner ────────────────────────────────────────── */}
      <EchoMotionSurface className="relative order-1 overflow-hidden rounded-2xl bg-[linear-gradient(120deg,rgba(251,247,238,0.96),rgba(220,232,214,0.7))] p-5 sm:order-2 sm:rounded-[2rem] sm:border sm:border-[var(--landing-primary-15)] sm:p-8 sm:shadow-[0_18px_48px_rgba(47,53,39,0.07)]">
        <div className="relative z-10 max-w-xl">
          <p className="hidden items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--landing-primary)] sm:flex">
            <span>Your private journal</span>
          </p>

          <h1 className="text-[2rem] font-bold leading-none tracking-tight text-[var(--landing-ink)] sm:mt-2 sm:text-4xl [font-family:var(--font-echo-display)]">
            <span className="sm:hidden">Your journal</span>
            <span className="hidden sm:inline">Pages to return to, at your pace.</span>
          </h1>

          <p className="mt-2 max-w-md text-sm leading-5 text-[var(--landing-muted)] sm:mt-2.5 sm:leading-relaxed">
            <span className="sm:hidden">A quiet place for what is on your mind.</span>
            <span className="hidden sm:inline">Keep small moments, honest thoughts, and the patterns you want to understand a little better.</span>
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2.5 sm:mt-5">
            <Link
              href="/journal/new"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--landing-primary)] px-5 text-sm font-bold text-[var(--landing-inverse)] shadow-sm outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--landing-primary-hover)] focus-visible:ring-4 focus-visible:ring-emerald-600/30 active:scale-[0.98] sm:h-11 sm:w-auto"
            >
              <PenLine className="h-4 w-4" aria-hidden="true" />
              <span>Open today&apos;s page</span>
            </Link>

            <span className="hidden h-11 items-center gap-2 rounded-full border border-[var(--landing-primary-15)] bg-white/80 px-4 text-xs font-semibold text-[var(--landing-ink)] shadow-xs sm:inline-flex">
              <CalendarDays className="h-4 w-4 text-[var(--landing-primary)]" aria-hidden="true" />
              <span>{pagination.totalItems} saved {pagination.totalItems === 1 ? "reflection" : "reflections"}</span>
            </span>
          </div>
        </div>

        {/* Hero Illustration */}
        <Image
          src={journalLandscape}
          alt="A doorway on a quiet hillside"
          priority
          className="absolute inset-y-0 right-0 hidden h-full w-[42%] object-cover object-center opacity-85 [mask-image:linear-gradient(to_left,black_65%,transparent)] md:block"
        />
      </EchoMotionSurface>

      {/* ── History Header & View Mode Switcher ─────────────────────── */}
      <div className="order-3 space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between gap-3 sm:items-end">
          <div>
            <p className="hidden text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--landing-primary)] sm:block">
              Reflection history
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--landing-ink)] sm:mt-0.5 [font-family:var(--font-echo-display)]">
              <span className="sm:hidden">Saved reflections</span>
              <span className="hidden sm:inline">Your saved pages</span>
            </h2>
            <p className="mt-0.5 text-xs text-[var(--landing-muted)] sm:hidden">{pagination.totalItems} saved {pagination.totalItems === 1 ? "page" : "pages"}</p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 rounded-full border border-black/10 bg-white p-1 shadow-xs" role="group" aria-label="Journal view">
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={`flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-bold transition-all duration-150 sm:min-h-0 sm:min-w-0 sm:px-3 sm:py-1.5 ${
                viewMode === "timeline"
                  ? "bg-[var(--landing-primary)] text-white shadow-xs"
                  : "text-[var(--landing-muted)] hover:text-[var(--landing-ink)]"
              }`}
              aria-label="Switch to timeline view"
            >
              <ListTree className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Timeline</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-bold transition-all duration-150 sm:min-h-0 sm:min-w-0 sm:px-3 sm:py-1.5 ${
                viewMode === "grid"
                  ? "bg-[var(--landing-primary)] text-white shadow-xs"
                  : "text-[var(--landing-muted)] hover:text-[var(--landing-ink)]"
              }`}
              aria-label="Switch to grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>
          </div>
        </div>

        {/* Filters */}
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

        {/* ── Content Stream ────────────────────────────────────────── */}
        {isLoading ? (
          <EchoLoadingState variant="skeleton" count={4} />
        ) : entries.length === 0 ? (
          <JournalEmptyState isFiltered={isFiltered} />
        ) : viewMode === "timeline" ? (
          /* ── Notebook Timeline Mode ── */
          <div className="space-y-8 pt-2">
            {groupedTimelineEntries.map((group) => (
              <section key={group.monthKey} className="space-y-4">
                {/* Month Group Header */}
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-2 rounded-full border border-[var(--landing-primary-15)] bg-[var(--landing-surface)] px-4 py-1.5 text-xs font-extrabold tracking-wider text-[var(--landing-ink)] shadow-xs">
                    <BookOpen className="h-3.5 w-3.5 text-[var(--landing-primary)]" />
                    <span>{group.monthKey}</span>
                  </span>
                  <div className="h-px flex-1 bg-[var(--landing-primary-10)]" />
                  <span className="text-[11px] font-medium text-[var(--landing-muted)]">
                    {group.items.length} {group.items.length === 1 ? "entry" : "entries"}
                  </span>
                </div>

                {/* Timeline items */}
                <div className="space-y-2 pl-1 sm:pl-2">
                  {group.items.map((entry, index) => (
                    <JournalTimelineEntry
                      key={entry.id}
                      entry={entry}
                      isLast={index === group.items.length - 1}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          /* ── Gallery Grid Mode ── */
          <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 pt-2">
            {entries.map((entry) => (
              <JournalCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        {/* ── Pagination ────────────────────────────────────────────── */}
        {pagination.totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 pt-6" aria-label="Pagination">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setPage(page)}
                className={`flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-bold outline-none transition focus-visible:ring-4 focus-visible:ring-emerald-600/20 ${
                  page === pagination.page
                    ? "bg-[var(--landing-primary)] text-white shadow-sm"
                    : "border border-black/10 bg-white text-[var(--landing-ink)] hover:bg-black/5"
                }`}
              >
                {page}
              </button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
