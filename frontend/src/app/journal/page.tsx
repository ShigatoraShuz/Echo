import Link from "next/link";
import { Filter, PenLine, Search } from "lucide-react";
import { EchoCard, EmptyState, JournalEntryCard, PageHeader } from "@/components/echo/shared";
import { AppShell } from "@/components/echo/shells";
import { journalEntries } from "@/lib/mock-data";

export default function JournalPage() {
  return (
    <AppShell>
      <PageHeader
        label="Journal"
        title="Reflection history"
        description="Search entries, filter by mood, and keep distress summaries in context. ECHO is not a diagnostic tool."
        action={
          <Link href="/journal/new" className="echo-button-primary">
            <PenLine className="h-4 w-4" aria-hidden="true" />
            New entry
          </Link>
        }
      />

      <EchoCard title="Search and filters" description="Static controls for the route-ready journal list.">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
            <input className="echo-input pl-10" placeholder="Search reflections, tags, or summaries" />
          </label>
          <label className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
            <select className="echo-input appearance-none pl-10">
              <option>All moods</option>
              <option>Calm</option>
              <option>Anxious</option>
              <option>Neutral</option>
            </select>
          </label>
          <select className="echo-input">
            <option>Newest first</option>
            <option>Lowest distress signal</option>
            <option>Highest distress signal</option>
          </select>
        </div>
      </EchoCard>

      <div className="grid gap-5 lg:grid-cols-3">
        {journalEntries.map((entry) => (
          <JournalEntryCard key={entry.id} entry={entry} />
        ))}
      </div>

      <EmptyState
        title="Filtered entries will appear here"
        description="When backend search is connected, empty states can explain which filters produced no results."
      />
    </AppShell>
  );
}
