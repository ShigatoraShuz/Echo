"use client";
import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";

interface SearchFilterProps {
  conversations: Array<{ id: string; title: string; lastMessage: string }>;
  onFilteredResults: (ids: string[]) => void;
}

export function BuddySearchFilter({ conversations, onFilteredResults }: SearchFilterProps) {
  const [query, setQuery] = useState("");

  const filteredIds = useMemo(() => {
    if (!query.trim()) return conversations.map((c) => c.id);
    const q = query.toLowerCase();
    return conversations
      .filter((c) => c.title.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q))
      .map((c) => c.id);
  }, [query, conversations]);

  function handleSearch(value: string) {
    setQuery(value);
    onFilteredResults(filteredIds);
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
        placeholder="Search conversations..."
        aria-label="Search conversations"
      />
      {query && (
        <button
          type="button"
          onClick={() => { setQuery(""); onFilteredResults(conversations.map((c) => c.id)); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-secondary"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
