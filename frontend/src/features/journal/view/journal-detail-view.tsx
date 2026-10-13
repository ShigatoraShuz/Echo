"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Trash2, Tag, Calendar, Info } from "lucide-react";
import { useJournalDetailViewModel } from "../view-model/use-journal-detail-view-model";
import { JournalAnalysisPanel } from "../components/journal-analysis-panel";
import { JournalDeleteDialog } from "../components/journal-delete-dialog";
import { JournalPhotoStack } from "../components/journal-photo-stack";
import { EchoCard } from "@/shared/components/ui/echo-card";
import { EchoBadge } from "@/shared/components/ui/echo-badge";
import { EchoButton } from "@/shared/components/ui/echo-button";
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

  if (isLoading) return <EchoLoadingState variant="skeleton" count={6} />;

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 rounded-full bg-secondary p-4 text-muted-foreground">
           <Info className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Entry not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">This reflection might have been moved or deleted.</p>
        <Link href="/journal" className="mt-6 text-sm font-bold text-primary hover:underline">Return to Journal</Link>
      </div>
    );
  }

  if (error && !entry) return <EchoErrorState title="Could not load entry" message={error} onRetry={retry} />;
  if (!entry) return null;

  return (
    <div className="flex min-w-0 flex-col gap-3 lg:h-full lg:min-h-0">
      <div className="echo-workspace-enter flex shrink-0 flex-col gap-3 rounded-[1.5rem] border border-border/70 bg-card/85 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Link href="/journal" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Pages
          </Link>
          <h1 className="break-words text-[clamp(1.75rem,2vw,2rem)] font-medium tracking-tight text-foreground [font-family:var(--font-echo-display)]">
            {entry.title}
          </h1>
          <p className="text-xs text-muted-foreground">Your private reflection and ECHO perspective</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <EchoButton variant="outline" onClick={exportEntry} isLoading={isExporting} className="rounded-xl">
            <Download className="h-4 w-4 mr-2" /> Export
          </EchoButton>
          <EchoButton variant="danger" onClick={() => setShowDeleteDialog(true)} className="rounded-xl">
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </EchoButton>
        </div>
      </div>

      {error && <p role="alert" className="shrink-0 rounded-xl border border-danger/30 bg-crisis-soft px-4 py-2 text-sm text-danger">{error}</p>}

      <div className="grid min-w-0 gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,62fr)_minmax(280px,38fr)]">
        <div className="echo-panel-scroll min-w-0 space-y-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1" tabIndex={0} aria-label="Full reflection">
          <EchoCard className="overflow-hidden border border-border/70 bg-card/90 shadow-sm">
            <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-5 py-3">
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                <Calendar className="h-3 w-3" /> {new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" }).format(new Date(entry.createdAt))}
              </span>
              <EchoBadge variant={entry.riskBand === "high" || entry.riskBand === "severe" ? "danger" : "default"}>
                {entry.mood}
              </EchoBadge>
            </div>
            
            <div className="p-5 sm:p-6">
              {!!entry.images?.length && <div className="mb-5 max-w-2xl"><JournalPhotoStack images={entry.images} /></div>}
              <div className="max-w-none">
                <p className="whitespace-pre-wrap break-words text-lg leading-[1.7] text-foreground [font-family:var(--font-echo-display)]">
                  {entry.body}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
                {entry.emotions.map((emotion) => (
                  <span key={emotion} className="rounded-lg bg-secondary px-3 py-1.5 text-[11px] font-bold text-primary">
                    {emotion}
                  </span>
                ))}
                {entry.tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                    <Tag className="h-3 w-3" /> {tag}
                  </span>
                ))}
              </div>
            </div>
          </EchoCard>

          <JournalAnalysisPanel analysis={analysis} />
        </div>

        <aside className="echo-panel-scroll min-w-0 space-y-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1" aria-label="Reflection analysis" tabIndex={0}>
          {analysis?.result ? <>
          <EchoCard className="border-border bg-secondary/50">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">Distress Signal</h2>
            
            <div className="flex flex-col items-center text-center">
              <div
                className="relative grid h-28 w-28 place-items-center rounded-full shadow-inner shadow-black/5"
                style={{
                  background: "hsl(var(--secondary))",
                }}
              >
                {/* Inner White Circle */}
                <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-card shadow-lg">
                  <span className="text-xl font-semibold capitalize text-foreground leading-none">{analysis.result.distressBand}</span>
                  <span className="mt-2 text-[10px] text-muted-foreground">AI distress estimate</span>
                </div>
              </div>

              <div className="mt-4 space-y-2 px-2">
                <EchoBadge variant={entry.riskBand === "high" || entry.riskBand === "severe" ? "danger" : entry.riskBand === "moderate" ? "warning" : "success"} className="px-4 py-1">
                  Band: {analysis.result.distressBand}{analysis.isDemoData ? " (simulated)" : ""}
                </EchoBadge>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  This score is a private reflective signal to help you decide what might support you next. 
                  <span className="mt-2 block font-bold text-muted-foreground italic">Not a diagnosis.</span>
                </p>
              </div>
            </div>
          </EchoCard>

          {/* Quick Summary Card */}
          <EchoCard title="Narrative Summary" className="border-border">
            <p className="text-sm leading-relaxed text-muted-foreground italic">
              &ldquo;{analysis.summary}&rdquo;
            </p>
          </EchoCard>
          </> : <EchoCard title="Your private reflection"><p className="text-sm leading-6 text-muted-foreground">No completed analysis is available for this entry. Your writing is safely saved; a missing result does not represent a low distress score.</p></EchoCard>}
        </aside>
      </div>

      <JournalDeleteDialog
        isOpen={showDeleteDialog}
        isDeleting={isDeleting}
        entryTitle={entry.title}
        onDelete={async () => {
          if (await deleteEntry()) router.push("/journal");
        }}
        onClose={() => setShowDeleteDialog(false)}
      />
    </div>
  );
}
