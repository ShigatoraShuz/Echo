"use client";
import { Search as SearchIcon, X } from "lucide-react";

interface JournalSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function JournalSearch({ value, onChange }: JournalSearchProps) {
  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Search entries..." aria-label="Search journal entries" />
      {value && (
        <button type="button" onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
