"use client";

import { Search, ArrowUpDown, X } from "lucide-react";
import type { JournalMood, JournalSortOption, JournalSearchFilters } from "../model/journal.model";
import { SORT_LABELS } from "../model/journal.schema";
import { MOOD_VISUAL_MAP } from "../utils/journal-formatters";

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
      <div className="flex flex-col gap-3 rounded-[1.75rem] border border-[var(--landing-primary-15)] bg-white/90 p-3.5 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:p-4">
        {/* Search Field */}
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--landing-muted)]"
            aria-hidden="true"
          />
          <input
            className="h-10 w-full rounded-2xl border border-black/10 bg-[var(--landing-surface)] pl-10 pr-9 text-xs font-medium text-[var(--landing-ink)] placeholder:text-[var(--landing-muted)] outline-none transition focus:border-[var(--landing-primary)] focus:bg-white focus:ring-4 focus:ring-emerald-600/10 sm:text-sm"
            placeholder="Search reflections, tags, or themes..."
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black/70"
              aria-label="Clear search input"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort Selector */}
        <div className="relative shrink-0">
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--landing-muted)]">
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
          <select
            className="h-10 appearance-none rounded-2xl border border-black/10 bg-[var(--landing-surface)] pl-9 pr-8 text-xs font-semibold text-[var(--landing-ink)] outline-none transition focus:border-[var(--landing-primary)] focus:bg-white focus:ring-4 focus:ring-emerald-600/10"
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
      <div className="flex flex-wrap items-center gap-1.5 px-1">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-[var(--landing-muted)]">
          Mood:
        </span>
        {MOOD_OPTIONS.map((item) => {
          const isSelected = filters.mood === item.key;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onMoodChange(item.key)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-150 active:scale-95 ${
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
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
          >
            <X className="h-3 w-3" />
            <span>Reset filters</span>
          </button>
        )}
      </div>
    </div>
  );
}
