"use client";
import type { JournalPagination } from "../model/journal.model";

interface JournalPaginationProps {
  pagination: JournalPagination;
  onPageChange: (page: number) => void;
}

export function JournalPaginationControls({ pagination, onPageChange }: JournalPaginationProps) {
  const { page, totalPages, totalItems } = pagination;

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-xs text-muted-foreground">{totalItems} entries</p>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/50 disabled:opacity-40">Previous</button>
        <span className="flex items-center px-2 text-xs text-muted-foreground">{page} / {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/50 disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

// Alternative load-more pattern
interface LoadMoreProps {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}

export function JournalLoadMore({ hasMore, isLoading, onLoadMore }: LoadMoreProps) {
  if (!hasMore) return <p className="py-4 text-center text-xs text-muted-foreground">All entries loaded</p>;
  return (
    <div className="pt-4 text-center">
      <button type="button" onClick={onLoadMore} disabled={isLoading} className="rounded-full border border-border bg-background px-6 py-2 text-xs font-semibold text-foreground hover:bg-secondary/50 disabled:opacity-50">
        {isLoading ? "Loading..." : "Load more"}
      </button>
    </div>
  );
}
