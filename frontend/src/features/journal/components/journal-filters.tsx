"use client";

import { Search, ArrowUpDown, X } from "lucide-react";
import type { JournalMood, JournalSortOption, JournalSearchFilters } from "../model/journal.model";
import { SORT_LABELS } from "../model/journal.schema";

interface JournalFiltersProps {
  filters: JournalSearchFilters;
  searchInput: string;
  onSearchChange: (value: string) => void;
  onSearchApply: () => void;
  onMoodChange: (mood: JournalMood | null) => void;
  onSortChange: (sort: JournalSortOption) => void;
  onReset: () => void;
  isFiltered: boolean;
}

const MOOD_OPTIONS: Array<{ key: JournalMood | null; label: string; emoji: string }> = [
  { key: null, label: "All moods", emoji: "✨" },
  { key: "calm", label: "Calm", emoji: "🌿" },
  { key: "happy", label: "Happy", emoji: "☀️" },
  { key: "neutral", label: "Neutral", emoji: "🍃" },
  { key: "anxious", label: "Anxious", emoji: "🌧️" },
  { key: "sad", label: "Sad", emoji: "💧" },
  { key: "angry", label: "Angry", emoji: "🔥" },
];

export function JournalFilters({
  filters,
  searchInput,
  onSearchChange,
  onSearchApply,
  onMoodChange,
  onSortChange,
  onReset,
  isFiltered,
}: JournalFiltersProps) {
  return (
    <div className="space-y-3">
      {/* ── Main Filter Bar ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-3 sm:rounded-[1.75rem] sm:border sm:border-[var(--landing-primary-15)] sm:bg-white/90 sm:p-4 sm:shadow-sm">
        {/* Search Field */}
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--landing-muted)]"
            aria-hidden="true"
          />
          <input
            className="h-11 w-full rounded-full border border-black/10 bg-white pl-10 pr-9 text-sm font-medium text-[var(--landing-ink)] placeholder:text-[var(--landing-muted)] outline-none transition focus:border-[var(--landing-primary)] focus:ring-4 focus:ring-emerald-600/10 sm:h-10 sm:rounded-2xl sm:bg-[var(--landing-surface)]"
            placeholder="Search pages"
            aria-label="Search reflections, tags, or themes"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearchApply();
            }}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-0 top-0 flex h-11 w-10 items-center justify-center text-[var(--landing-muted)] hover:text-[var(--landing-ink)]"
              aria-label="Clear search input"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort Selector */}
        <div className="relative w-11 shrink-0 sm:w-auto">
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--landing-muted)]">
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
          <select
            className="h-11 w-11 appearance-none rounded-full border border-black/10 bg-white text-transparent outline-none transition focus:border-[var(--landing-primary)] focus:ring-4 focus:ring-emerald-600/10 sm:h-10 sm:w-auto sm:rounded-2xl sm:bg-[var(--landing-surface)] sm:pl-9 sm:pr-8 sm:text-xs sm:font-semibold sm:text-[var(--landing-ink)]"
            value={filters.sort}
            onChange={(e) => onSortChange(e.target.value as JournalSortOption)}
            aria-label="Sort reflections"
          >
            {Object.entries(SORT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Quick Mood Filter Pills ──────────────────────────────────── */}
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:gap-1.5 sm:overflow-visible sm:px-1 sm:pb-0" role="group" aria-label="Filter by mood">
        <span className="mr-1 hidden text-[11px] font-bold uppercase tracking-wider text-[var(--landing-muted)] sm:inline">
          Mood:
        </span>
        {MOOD_OPTIONS.map((item) => {
          const isSelected = filters.mood === item.key;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onMoodChange(item.key)}
              className={`inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold transition-all duration-150 active:scale-95 sm:min-h-0 sm:py-1 ${
                isSelected
                  ? "bg-[var(--landing-primary)] text-white shadow-xs"
                  : "border border-black/10 bg-white text-[var(--landing-muted)] hover:border-[var(--landing-primary-15)] hover:bg-[var(--landing-surface)] hover:text-[var(--landing-ink)]"
              }`}
            >
              <span className="text-[11px]">{item.emoji}</span>
              <span>{item.label}</span>
            </button>
          );
        })}

        {isFiltered && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 sm:ml-auto sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-[11px]"
          >
            <X className="h-3 w-3" />
            <span>Reset filters</span>
          </button>
        )}
      </div>
    </div>
  );
}
