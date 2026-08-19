"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  LayoutGrid,
  ListFilter,
  ListTree,
  PenLine,
  Sparkles,
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

  const [viewMode, setViewMode] = useState<JournalViewMode>("timeline");

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
    <div className="space-y-6 [font-family:var(--font-echo-sans)]">
      {/* ── Top Hero Banner ────────────────────────────────────────── */}
      <EchoMotionSurface className="relative overflow-hidden rounded-[2rem] border border-[var(--landing-primary-15)] bg-[linear-gradient(120deg,rgba(251,247,238,0.96),rgba(220,232,214,0.7))] p-6 shadow-[0_18px_48px_rgba(47,53,39,0.07)] sm:p-8">
        <div className="relative z-10 max-w-xl">
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--landing-primary)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Your private journal</span>
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--landing-ink)] sm:text-4xl [font-family:var(--font-echo-display)]">
            Pages to return to, at your pace.
          </h1>

          <p className="mt-2.5 max-w-md text-xs leading-relaxed text-[var(--landing-muted)] sm:text-sm">
            Keep small moments, honest thoughts, and the patterns you want to understand a little better.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Link
              href="/journal/new"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--landing-primary)] px-5 text-sm font-bold text-[var(--landing-inverse)] shadow-sm outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--landing-primary-hover)] focus-visible:ring-4 focus-visible:ring-emerald-600/30 active:scale-[0.98]"
            >
              <PenLine className="h-4 w-4" aria-hidden="true" />
              <span>Open today&apos;s page</span>
            </Link>

            <span className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--landing-primary-15)] bg-white/80 px-4 text-xs font-semibold text-[var(--landing-ink)] shadow-xs">
              <CalendarDays className="h-4 w-4 text-[var(--landing-primary)]" aria-hidden="true" />
              <span>{entries.length} saved {entries.length === 1 ? "reflection" : "reflections"}</span>
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
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--landing-primary)]">
              Reflection history
            </p>
            <h2 className="mt-0.5 text-xl font-bold tracking-tight text-[var(--landing-ink)] sm:text-2xl [font-family:var(--font-echo-display)]">
              Your saved pages
            </h2>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 rounded-full border border-black/10 bg-white p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-150 ${
                viewMode === "timeline"
                  ? "bg-[var(--landing-primary)] text-white shadow-xs"
                  : "text-[var(--landing-muted)] hover:text-[var(--landing-ink)]"
              }`}
              aria-label="Switch to timeline view"
            >
              <ListTree className="h-3.5 w-3.5" />
              <span>Timeline</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-150 ${
                viewMode === "grid"
                  ? "bg-[var(--landing-primary)] text-white shadow-xs"
                  : "text-[var(--landing-muted)] hover:text-[var(--landing-ink)]"
              }`}
              aria-label="Switch to grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Grid</span>
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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 pt-2">
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
