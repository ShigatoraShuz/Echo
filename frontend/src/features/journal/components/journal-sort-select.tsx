"use client";
import type { JournalSortOption } from "../model/journal.model";

interface JournalSortProps {
  value: JournalSortOption;
  onChange: (sort: JournalSortOption) => void;
}

const OPTIONS: Array<{ value: JournalSortOption; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "highest-risk", label: "Highest risk" },
  { value: "lowest-risk", label: "Lowest risk" },
];

export function JournalSortSelect({ value, onChange }: JournalSortProps) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as JournalSortOption)} className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
