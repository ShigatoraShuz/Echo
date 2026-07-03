import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import { DataChartCard, EchoCard, MoodBadge, PageHeader, RiskScoreRing } from "@/components/echo/shared";
import { AppShell } from "@/components/echo/shells";
import { journalEntries } from "@/lib/mock-data";

export function generateStaticParams() {
  return journalEntries.map((entry) => ({ id: entry.id }));
}

export default async function JournalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = journalEntries.find((item) => item.id === id);

  if (!entry) {
    notFound();
  }

  return (
    <AppShell>
      <PageHeader
        label="Journal detail"
        title={entry.title}
        description="Review the entry, emotion tags, distress summary, and ECHO perspective. None of this is diagnostic."
        action={
          <Link href="/journal" className="echo-button-secondary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <EchoCard title="Reflection" description={entry.date}>
            <p className="text-base leading-8 text-foreground">{entry.body}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <MoodBadge mood={entry.mood} />
              {entry.emotions.map((emotion) => (
                <span key={emotion} className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                  {emotion}
                </span>
              ))}
            </div>
          </EchoCard>

          <EchoCard title="ECHO perspective" description="A reflective summary, not clinical interpretation.">
            <div className="flex gap-3 rounded-2xl border border-border/70 bg-background p-4">
              <Bot className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-sm leading-6 text-muted-foreground">{entry.perspective}</p>
            </div>
          </EchoCard>

          <DataChartCard title="Entry intensity" description="Start-to-end signal movement within this sample entry." points={entry.trend} />
        </div>

        <aside className="space-y-6">
          <EchoCard title="Distress summary" description={entry.summary}>
            <RiskScoreRing score={entry.riskScore} band={entry.riskBand} />
          </EchoCard>

          <EchoCard title="Tags" description="Ready for backend filtering.">
            <div className="flex flex-wrap gap-2">
              {entry.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          </EchoCard>
        </aside>
      </div>
    </AppShell>
  );
}
