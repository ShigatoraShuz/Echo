"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, ImagePlus, PenLine, Search } from "lucide-react";
import { useJournalListViewModel } from "../view-model/use-journal-list-view-model";
import { goEmotionNameSchema, plutchikEmotionSchema, emotionNameSchema } from "@echo/contracts";
import type { JournalEntry } from "../model/journal.model";
import { EchoErrorState } from "@/shared/components/feedback/echo-error-state";
import { JournalPhotoStack } from "../components/journal-photo-stack";
import { JournalPolaroid } from "../components/journal-polaroid";

const mainEmotions: readonly string[] = plutchikEmotionSchema.options;
const moreEmotions: string[] = [...new Set([...goEmotionNameSchema.options, ...emotionNameSchema.options])]
  .filter(emotion => !mainEmotions.includes(emotion)).sort();
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
        <p className="mt-3 text-xs text-[var(--landing-muted)]">Filter by saved AI emotion signals</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 pb-2" aria-label="Filter by detected emotion">
          <button
            type="button"
            onClick={() => vm.setEmotionFilter(null)}
            aria-pressed={!vm.filters.emotion}
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${!vm.filters.emotion ? "bg-[var(--landing-primary)] text-white" : "border border-[var(--landing-primary-15)] text-[var(--landing-muted)]"}`}
          >
            All entries
          </button>
          {mainEmotions.map((emotion) => (
            <button
              key={emotion}
              type="button"
              onClick={() => vm.setEmotionFilter(emotion)}
              aria-pressed={vm.filters.emotion === emotion}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold capitalize ${vm.filters.emotion === emotion ? "bg-[var(--landing-primary)] text-white" : "border border-[var(--landing-primary-15)] text-[var(--landing-muted)]"}`}
            >
              {emotion}
            </button>
          ))}
          <div className="relative">
            <select
              aria-label="More emotions"
              value={moreEmotions.includes(vm.filters.emotion ?? "") ? vm.filters.emotion! : ""}
              onChange={event => vm.setEmotionFilter(event.target.value)}
              className={`min-h-9 max-w-full appearance-none rounded-full border py-2 pl-3 pr-8 text-xs font-semibold capitalize outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--landing-primary)] focus-visible:ring-offset-2 ${moreEmotions.includes(vm.filters.emotion ?? "") ? "border-transparent bg-[var(--landing-primary)] text-white" : "border-[var(--landing-primary-15)] bg-card text-[var(--landing-muted)]"}`}
            >
              <option value="" disabled>More emotions</option>
              {moreEmotions.map(emotion => (
                <option key={emotion} value={emotion}>{emotion.charAt(0).toUpperCase() + emotion.slice(1)}</option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
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
        {vm.isFiltered && (
          <button
            type="button"
            onClick={vm.resetFilters}
            className="mt-2 self-start rounded-full px-3 py-2 text-xs font-semibold text-[var(--landing-primary)] underline-offset-4 hover:underline focus-visible:ring-4 focus-visible:ring-ring/20"
          >
            Clear search and filters
          </button>
        )}
        <div
          className="echo-panel-scroll mt-3 space-y-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2"
          aria-busy={vm.isLoading}
          tabIndex={0}
          aria-label="Journal entries"
        >
          {vm.error && vm.entries.length > 0 && (
            <p role="alert" className="rounded-xl border border-danger/30 bg-crisis-soft p-3 text-sm text-danger">
              {vm.error}{" "}
              <button type="button" onClick={vm.retry} className="font-semibold underline">
                Retry
              </button>
            </p>
          )}
          {vm.isLoading && vm.entries.length > 0 && (
            <p role="status" className="px-4 text-xs text-[var(--landing-muted)]">
              Updating reflections…
            </p>
          )}
          {vm.isLoading && vm.entries.length === 0 ? (
            <p className="p-6 text-sm text-[var(--landing-muted)]">Loading your reflections…</p>
          ) : vm.entries.length === 0 ? (
            <div className="rounded-2xl bg-[var(--landing-cream)] p-6 text-sm text-[var(--landing-muted)]">
              {vm.isFiltered ? "No entries match these filters." : "Your journal is ready for its first page."}
            </div>
          ) : (
            vm.entries.map((entry) => {
              const summary = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-1 font-semibold text-[var(--landing-ink)]">{entry.title}</span>
                    {entry.emotions.length > 0 && (
                      <span className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-[10px] capitalize text-[var(--landing-primary)]">
                        {entry.emotions[0]}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--landing-muted)]">
                    {entry.excerpt || entry.body}
                  </p>
                  <p className="mt-2 text-[11px] text-[var(--landing-muted)]">
                    {dateFormat.format(new Date(entry.createdAt))} ·{" "}
                    {entry.body.trim().split(/\s+/).filter(Boolean).length} words{" "}
                    {entry.images?.length ? `· ${entry.images.length} photos` : ""}
                  </p>
                </>
              );
              return (
                <div key={entry.id}>
                  <Link
                    href={`/journal/${encodeURIComponent(entry.id)}`}
                    className="echo-workspace-tile block rounded-2xl p-4 outline-none focus-visible:ring-4 focus-visible:ring-ring/20 lg:hidden"
                  >
                    {summary}
                    {entry.images?.[0] && <div className="mt-3"><JournalPolaroid src={entry.images[0].url} alt={`Preview photo from ${entry.title}`} caption="Memory 1" /></div>}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSelectedId(entry.id)}
                    aria-current={selected?.id === entry.id ? "true" : undefined}
                    className={`echo-workspace-tile hidden w-full rounded-2xl border-l-[3px] p-4 text-left outline-none focus-visible:ring-4 focus-visible:ring-ring/20 lg:block ${selected?.id === entry.id ? "border-[var(--landing-primary)] bg-[var(--landing-sage-soft)]" : "border-transparent hover:bg-[var(--landing-cream)]"}`}
                  >
                    {summary}
                  </button>
                </div>
              );
            })
          )}
        </div>
        {vm.pagination.totalPages > 1 && (
          <nav
            aria-label="Journal pages"
            className="mt-3 flex shrink-0 items-center justify-between border-t border-border/60 pt-2"
          >
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
        className="echo-workspace-enter echo-panel-scroll hidden min-w-0 rounded-[1.5rem] border border-border/70 bg-[var(--landing-cream)] p-5 shadow-sm lg:block lg:min-h-0 lg:overflow-y-auto lg:p-7"
        tabIndex={0}
      >
        {selected ? (
          <article key={selected.id} className="journal-reading-swap">
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
            {selected.images?.length ? (
              <div className="mt-5 max-w-2xl">
                <JournalPhotoStack images={selected.images} />
              </div>
            ) : null}
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
