import Link from "next/link";
import type { JournalEntry } from "../model/journal.model";
import { MOOD_LABELS } from "../model/journal.schema";
import { EchoBadge } from "@/shared/components/ui/echo-badge";

interface JournalCardProps {
  entry: JournalEntry;
}

export function JournalCard({ entry }: JournalCardProps) {
  return (
    <article className="min-w-0 rounded-2xl border border-border/70 bg-background p-5 shadow-subtle">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{entry.createdAt}</p>
          <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground">{entry.title}</h2>
        </div>
        <EchoBadge variant={entry.riskBand === "high" || entry.riskBand === "severe" ? "danger" : entry.riskBand === "moderate" ? "warning" : "default"} size="small">
          {MOOD_LABELS[entry.mood]}
        </EchoBadge>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{entry.excerpt}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <EchoBadge variant="neutral" size="small">{entry.riskBand}</EchoBadge>
        {entry.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>
      <Link href={`/journal/${entry.id}`} className="mt-5 inline-flex text-sm font-semibold text-primary">
        Read reflection
      </Link>
    </article>
  );
}
