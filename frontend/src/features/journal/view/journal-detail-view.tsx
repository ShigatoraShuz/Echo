"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Trash2, Tag, Calendar, Info } from "lucide-react";
import { useJournalDetailViewModel } from "../view-model/use-journal-detail-view-model";
import { JournalAnalysisPanel } from "../components/journal-analysis-panel";
import { JournalDeleteDialog } from "../components/journal-delete-dialog";
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
    <div className="mx-auto max-w-7xl pb-20">
      {/* 1. REFINED HEADER AREA */}
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between border-b border-border pb-8">
        <div className="space-y-4">
          <Link href="/journal" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Pages
          </Link>
          <h1 className="text-4xl font-medium tracking-tight text-foreground lg:text-5xl [font-family:var(--font-echo-display)]">
            {entry.title}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A review of your reflection, emotion tags, and ECHO perspective.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <EchoButton variant="outline" onClick={exportEntry} isLoading={isExporting} className="rounded-xl">
            <Download className="h-4 w-4 mr-2" /> Export
          </EchoButton>
          <EchoButton variant="danger" onClick={() => setShowDeleteDialog(true)} className="rounded-xl">
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </EchoButton>
        </div>
      </div>

      {/* 2. MAIN CONTENT GRID */}
      <div className="grid gap-8 lg:grid-cols-12">
        
        {/* LEFT COLUMN: The Reflection */}
        <div className="space-y-8 lg:col-span-8">
          <EchoCard className="overflow-hidden border-none bg-card shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between border-b border-border px-8 py-4 bg-secondary/30">
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                <Calendar className="h-3 w-3" /> {entry.createdAt}
              </span>
              <EchoBadge variant={entry.riskBand === "high" || entry.riskBand === "severe" ? "danger" : "default"}>
                {entry.mood}
              </EchoBadge>
            </div>
            
            <div className="p-8">
              {!!entry.images?.length && <div className="mb-6 grid gap-3 sm:grid-cols-2">{entry.images.map((photo,index) => <img key={photo.id} src={photo.url} alt={`Photo ${index+1} from this reflection`} referrerPolicy="no-referrer" className="max-h-96 w-full rounded-2xl object-cover" />)}</div>}
              <div className="prose prose-slate max-w-none">
                <p className="text-lg leading-[1.8] text-foreground whitespace-pre-line font-light">
                  {entry.body}
                </p>
              </div>

              {/* Emotions & Tags inside the main card for context */}
              <div className="mt-12 flex flex-wrap gap-2 border-t border-border pt-8">
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

        {/* RIGHT COLUMN: Metadata & Signal */}
        <aside className="space-y-6 lg:col-span-4">
          {analysis?.result ? <>
          <EchoCard className="sticky top-6 border-border bg-secondary/50">
            <h2 className="mb-6 text-sm font-bold uppercase tracking-widest text-muted-foreground">Distress Signal</h2>
            
            <div className="flex flex-col items-center text-center">
              <div
                className="relative grid h-40 w-40 place-items-center rounded-full shadow-inner shadow-black/5"
                style={{
                  background: "hsl(var(--secondary))",
                }}
              >
                {/* Inner White Circle */}
                <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-card shadow-2xl">
                  <span className="text-2xl font-semibold capitalize text-foreground leading-none">{analysis.result.distressBand}</span>
                  <span className="mt-2 text-[10px] text-muted-foreground">AI distress estimate</span>
                </div>
              </div>

              <div className="mt-8 space-y-3 px-4">
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
          await deleteEntry();
          if (!isDeleting) router.push("/journal");
        }}
        onClose={() => setShowDeleteDialog(false)}
      />
    </div>
  );
}
