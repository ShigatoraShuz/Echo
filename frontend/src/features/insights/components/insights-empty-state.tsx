"use client";
import { BarChart3, PenLine } from "lucide-react";
import Link from "next/link";

interface InsightsEmptyStateProps {
  hasJournalEntries?: boolean;
}

export function InsightsEmptyState({ hasJournalEntries }: InsightsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
        <BarChart3 className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-foreground">No insights yet</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Insights appear as you journal and track your mood. The more you share, the more patterns ECHO can help you notice.
      </p>
      {!hasJournalEntries && (
        <Link href="/journal/new" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
          <PenLine className="h-4 w-4" /> Write your first entry
        </Link>
      )}
    </div>
  );
}
