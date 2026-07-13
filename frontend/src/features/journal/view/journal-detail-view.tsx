"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { useJournalDetailViewModel } from "../view-model/use-journal-detail-view-model";
import { JournalAnalysisPanel } from "../components/journal-analysis-panel";
import { JournalDeleteDialog } from "../components/journal-delete-dialog";
import { EchoCard } from "@/shared/components/ui/echo-card";
import { EchoBadge } from "@/shared/components/ui/echo-badge";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoPageHeading } from "@/shared/components/data-display/echo-page-heading";
import { EchoLoadingState } from "@/shared/components/feedback/echo-loading-state";
import { EchoErrorState } from "@/shared/components/feedback/echo-error-state";

interface JournalDetailViewProps {
  id: string;
}

export function JournalDetailView({ id }: JournalDetailViewProps) {
  const router = useRouter();
  const {
    entry, analysis, isLoading, isDeleting, isExporting,
    showDeleteDialog, error, notFound,
    deleteEntry, exportEntry, openDeleteDialog: setShowDeleteDialog, retry,
  } = useJournalDetailViewModel(id);

  if (isLoading) {
    return <EchoLoadingState variant="skeleton" count={6} />;
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <h2 className="text-xl font-semibold text-foreground">Entry not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">This journal entry could not be found.</p>
        <Link href="/journal" className="mt-5 text-sm font-semibold text-primary">Back to journal</Link>
      </div>
    );
  }

  if (error && !entry) {
    return <EchoErrorState title="Could not load entry" message={error} onRetry={retry} />;
  }

  if (!entry) return null;

  return (
    <div>
      <EchoPageHeading
        title={entry.title}
        description="Review the entry, emotion tags, distress summary, and ECHO perspective. None of this is diagnostic."
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/journal"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border/70 bg-card px-4 text-sm font-semibold text-foreground shadow-subtle transition hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring/20"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Link>
            <EchoButton variant="outline" size="small" onClick={exportEntry} isLoading={isExporting}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </EchoButton>
            <EchoButton variant="danger" size="small" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete
            </EchoButton>
          </div>
        }
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <EchoCard title="Reflection" description={entry.createdAt}>
            <p className="text-base leading-8 text-foreground whitespace-pre-line">{entry.body}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <EchoBadge variant={entry.riskBand === "high" || entry.riskBand === "severe" ? "danger" : entry.riskBand === "moderate" ? "warning" : "default"} size="small">
                {entry.mood}
              </EchoBadge>
              {entry.emotions.map((emotion) => (
                <span key={emotion} className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                  {emotion}
                </span>
              ))}
            </div>
          </EchoCard>

          <JournalAnalysisPanel analysis={analysis} />

          <EchoCard title="Tags">
            <div className="flex flex-wrap gap-2">
              {entry.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          </EchoCard>
        </div>

        <aside className="space-y-6">
          <EchoCard title="Distress summary" description={entry.summary}>
            <div className="flex items-center gap-4">
              <div
                className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(hsl(var(--risk-${entry.riskBand})) ${entry.riskScore * 3.6}deg, hsl(var(--risk-${entry.riskBand}-soft)) 0deg)`,
                }}
                aria-label={`Distress signal: ${entry.riskScore} out of 100, ${entry.riskBand}`}
              >
                <div className="grid h-20 w-20 place-items-center rounded-full bg-card text-center shadow-subtle">
                  <span className="text-2xl font-semibold text-foreground">{entry.riskScore}</span>
                </div>
              </div>
              <div className="space-y-2">
                <EchoBadge variant={entry.riskBand === "high" || entry.riskBand === "severe" ? "danger" : entry.riskBand === "moderate" ? "warning" : "success"} size="small">
                  {entry.riskBand}
                </EchoBadge>
                <p className="text-sm leading-6 text-muted-foreground">
                  Distress signal only. This is not a diagnosis or diagnostic tool.
                </p>
              </div>
            </div>
          </EchoCard>
        </aside>
      </div>

      <JournalDeleteDialog
        open={showDeleteDialog}
        isDeleting={isDeleting}
        title={entry.title}
        onConfirm={async () => {
          await deleteEntry();
          if (!isDeleting) router.push("/journal");
        }}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </div>
  );
}
