import { Inbox } from "lucide-react";
import Link from "next/link";

interface JournalEmptyStateProps {
  isFiltered: boolean;
}

export function JournalEmptyState({ isFiltered }: JournalEmptyStateProps) {
  if (isFiltered) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border/70 bg-background p-10 text-center">
        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <h3 className="mt-4 text-base font-semibold text-foreground">No matching entries</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Try adjusting your search or filters to find what you are looking for.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border/70 bg-background p-10 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <h3 className="mt-4 text-base font-semibold text-foreground">No entries yet</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        Start with a short note whenever you are ready.
      </p>
      <Link
        href="/journal/new"
        className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-subtle transition hover:bg-primary/90"
      >
        Write your first entry
      </Link>
    </div>
  );
}
