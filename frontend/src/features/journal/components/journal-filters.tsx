"use client";

import { Search, Filter } from "lucide-react";
import type { JournalMood, JournalSortOption, JournalSearchFilters } from "../model/journal.model";
import { MOOD_LABELS, SORT_LABELS } from "../model/journal.schema";

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
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-subtle">
      <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
          <input
            className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="Search reflections, tags, or summaries"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSearchApply(); }}
          />
        </label>
        <label className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
          <select
            className="h-11 w-full appearance-none rounded-xl border border-input bg-background pl-10 pr-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            value={filters.mood || ""}
            onChange={(e) => onMoodChange(e.target.value ? (e.target.value as JournalMood) : null)}
          >
            <option value="">All moods</option>
            {Object.entries(MOOD_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <select
          className="h-11 w-full appearance-none rounded-xl border border-input bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          value={filters.sort}
          onChange={(e) => onSortChange(e.target.value as JournalSortOption)}
        >
          {Object.entries(SORT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>
      {isFiltered && (
        <button
          type="button"
          onClick={onReset}
          className="mt-3 text-xs font-medium text-primary hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
