"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, ImagePlus, PenLine, Search } from "lucide-react";
import { useJournalListViewModel } from "../view-model/use-journal-list-view-model";
import type { JournalEntry, JournalMood } from "../model/journal.model";
import { EchoErrorState } from "@/shared/components/feedback/echo-error-state";
import { JournalPhotoStack } from "../components/journal-photo-stack";

const moods: JournalMood[] = ["calm", "happy", "neutral", "sad", "anxious", "angry"];
const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function JournalNotebookView() {
  const vm = useJournalListViewModel();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected: JournalEntry | undefined = vm.entries.find((entry) => entry.id === selectedId) ?? vm.entries[0];

  useEffect(() => {
    if (selectedId && !vm.entries.some((entry) => entry.id === selectedId)) setSelectedId(null);
  }, [selectedId, vm.entries]);

  if (vm.error && vm.entries.length === 0)
    return <EchoErrorState title="Could not load journal entries" message={vm.error} onRetry={vm.retry} />;

  return (
    <main className="grid min-w-0 gap-3 [font-family:var(--font-echo-sans)] lg:h-full lg:min-h-0 lg:grid-cols-[minmax(310px,38fr)_minmax(0,62fr)]">
      <section
        aria-label="Your journal history"
        className="echo-workspace-enter min-w-0 rounded-[1.5rem] border border-border/70 bg-card/90 p-4 shadow-sm lg:flex lg:min-h-0 lg:flex-col"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.15em] text-[var(--landing-primary)]">
              Your private space
            </p>
            <h1 className="mt-1 text-[clamp(1.75rem,2vw,2rem)] leading-tight text-[var(--landing-ink)] [font-family:var(--font-echo-display)]">
              Your Journal
            </h1>
            <p className="mt-1 text-sm text-[var(--landing-muted)]">
              A space for your thoughts, reflections, and growth.
            </p>
          </div>
          <Link
            href="/journal/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--landing-primary)] px-4 text-sm font-semibold text-white"
          >
            <PenLine size={16} />
            Write reflection
          </Link>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            vm.applySearch();
          }}
          className="mt-4 flex items-center gap-2 rounded-full border border-[var(--landing-primary-15)] bg-white px-4"
        >
          <Search size={17} className="text-[var(--landing-muted)]" />
          <input
            value={vm.searchInput}
            onChange={(event) => vm.setSearch(event.target.value)}
            placeholder="Search entries…"
            aria-label="Search journal entries"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <button type="submit" className="text-xs font-semibold text-[var(--landing-primary)]">
            Search
          </button>
        </form>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2" aria-label="Filter by mood">
          <button
            type="button"
            onClick={() => vm.setMoodFilter(null)}
            aria-pressed={vm.filters.mood === null}
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${vm.filters.mood === null ? "bg-[var(--landing-primary)] text-white" : "border border-[var(--landing-primary-15)] text-[var(--landing-muted)]"}`}
          >
            All entries
          </button>
          {moods.map((mood) => (
            <button
              key={mood}
              type="button"
              onClick={() => vm.setMoodFilter(mood)}
              aria-pressed={vm.filters.mood === mood}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold capitalize ${vm.filters.mood === mood ? "bg-[var(--landing-primary)] text-white" : "border border-[var(--landing-primary-15)] text-[var(--landing-muted)]"}`}
            >
              {mood}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Link
            href="/journal/drafts"
            className="text-xs font-semibold text-[var(--landing-primary)] underline-offset-4 hover:underline"
          >
            Resume a draft
          </Link>
          <select
            aria-label="Sort entries"
            value={vm.filters.sort}
            onChange={(event) => vm.setSort(event.target.value as "newest" | "oldest")}
            className="rounded-full border border-[var(--landing-primary-15)] bg-white px-3 py-2 text-xs text-[var(--landing-ink)]"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
        <div className="echo-panel-scroll mt-3 space-y-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2" aria-busy={vm.isLoading} tabIndex={0} aria-label="Journal entries">
          {vm.error && vm.entries.length > 0 && (
            <p role="alert" className="rounded-xl border border-danger/30 bg-crisis-soft p-3 text-sm text-danger">
              {vm.error} <button type="button" onClick={vm.retry} className="font-semibold underline">Retry</button>
            </p>
          )}
          {vm.isLoading && vm.entries.length > 0 && <p role="status" className="px-4 text-xs text-[var(--landing-muted)]">Updating reflections…</p>}
          {vm.isLoading && vm.entries.length === 0 ? (
            <p className="p-6 text-sm text-[var(--landing-muted)]">Loading your reflections…</p>
          ) : vm.entries.length === 0 ? (
            <div className="rounded-2xl bg-[var(--landing-cream)] p-6 text-sm text-[var(--landing-muted)]">
              {vm.isFiltered ? "No entries match these filters." : "Your journal is ready for its first page."}
            </div>
          ) : (
            vm.entries.map((entry) => (
              <button
                type="button"
                key={entry.id}
                onClick={() => setSelectedId(entry.id)}
                aria-current={selected?.id === entry.id ? "true" : undefined}
                className={`echo-workspace-tile w-full rounded-2xl border-l-[3px] p-4 text-left outline-none focus-visible:ring-4 focus-visible:ring-ring/20 ${selected?.id === entry.id ? "border-[var(--landing-primary)] bg-[var(--landing-sage-soft)]" : "border-transparent hover:bg-[var(--landing-cream)]"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-1 font-semibold text-[var(--landing-ink)]">{entry.title}</span>
                  <span className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-[10px] capitalize text-[var(--landing-primary)]">
                    {entry.mood}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--landing-muted)]">
                  {entry.excerpt || entry.body}
                </p>
                <p className="mt-2 text-[11px] text-[var(--landing-muted)]">
                  {dateFormat.format(new Date(entry.createdAt))} ·{" "}
                  {entry.body.trim().split(/\s+/).filter(Boolean).length} words{" "}
                  {entry.images?.length ? `· ${entry.images.length} photos` : ""}
                </p>
              </button>
            ))
          )}
        </div>
        {vm.pagination.totalPages > 1 && (
          <nav aria-label="Journal pages" className="mt-3 flex shrink-0 items-center justify-between border-t border-border/60 pt-2">
            <button
              type="button"
              disabled={vm.pagination.page <= 1}
              onClick={() => vm.setPage(vm.pagination.page - 1)}
              className="rounded-full border border-[var(--landing-primary-15)] p-2 disabled:opacity-40"
              aria-label="Previous journal page"
            >
              <ChevronLeft size={17} />
            </button>
            <span className="text-xs text-[var(--landing-muted)]">
              Page {vm.pagination.page} of {vm.pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={vm.pagination.page >= vm.pagination.totalPages}
              onClick={() => vm.setPage(vm.pagination.page + 1)}
              className="rounded-full border border-[var(--landing-primary-15)] p-2 disabled:opacity-40"
              aria-label="Next journal page"
            >
              <ChevronRight size={17} />
            </button>
          </nav>
        )}
      </section>
      <section
        aria-label="Selected reflection"
        className="echo-workspace-enter echo-panel-scroll min-w-0 rounded-[1.5rem] border border-border/70 bg-[var(--landing-cream)] p-5 shadow-sm lg:min-h-0 lg:overflow-y-auto lg:p-7"
        tabIndex={0}
      >
        {selected ? (
          <article key={selected.id} className="echo-reading-swap">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--landing-muted)]">
                  {dateFormat.format(new Date(selected.createdAt))}
                </p>
                <h2 className="mt-2 text-[clamp(1.75rem,2.3vw,2.25rem)] leading-tight text-[var(--landing-ink)] [font-family:var(--font-echo-display)]">
                  {selected.title}
                </h2>
                <p className="mt-3 text-sm capitalize text-[var(--landing-primary)]">
                  {selected.mood} · {selected.body.trim().split(/\s+/).filter(Boolean).length} words
                </p>
              </div>
              <Link
                href={`/journal/${encodeURIComponent(selected.id)}`}
                className="inline-flex min-h-11 items-center rounded-full border border-[var(--landing-primary-15)] bg-white px-4 text-sm font-semibold text-[var(--landing-primary)]"
              >
                Open full page
              </Link>
            </div>
            {selected.images?.length ? <div className="mt-5 max-w-2xl"><JournalPhotoStack images={selected.images} /></div> : null}
            <div className="mt-6 space-y-5 whitespace-pre-wrap break-words text-lg leading-8 text-[var(--landing-ink)] [font-family:var(--font-echo-display)]">
              {selected.body}
            </div>
            {selected.tags.length > 0 && (
              <p className="mt-8 flex flex-wrap gap-2">
                {selected.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[var(--landing-sage-soft)] px-3 py-1 text-xs text-[var(--landing-primary)]"
                  >
                    #{tag}
                  </span>
                ))}
              </p>
            )}
            <div className="mt-10 border-t border-[var(--landing-primary-15)] pt-6">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--landing-primary)]">
                Reflect on this page
              </p>
              <p className="mt-2 text-sm text-[var(--landing-muted)]">
                Return to the full entry to view completed analysis, export, or delete it.
              </p>
              <Link
                href={`/journal/${encodeURIComponent(selected.id)}`}
                className="mt-3 inline-flex text-sm font-semibold text-[var(--landing-primary)] underline-offset-4 hover:underline"
              >
                View details and actions →
              </Link>
            </div>
          </article>
        ) : (
          <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
            <BookOpen size={34} className="text-[var(--landing-primary)]" />
            <h2 className="mt-4 text-3xl text-[var(--landing-ink)] [font-family:var(--font-echo-display)]">
              Your next page begins here
            </h2>
            <p className="mt-2 text-sm text-[var(--landing-muted)]">
              Words, moods, and optional photos all belong in your journal.
            </p>
            <Link
              href="/journal/new"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--landing-primary)] px-5 py-3 text-sm font-semibold text-white"
            >
              <ImagePlus size={16} />
              Write and add photos
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
