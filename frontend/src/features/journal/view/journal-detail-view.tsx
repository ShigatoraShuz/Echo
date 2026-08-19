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

  if (isLoading) return <EchoLoadingState variant="skeleton" count={6} />;

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 rounded-full bg-slate-50 p-4 text-slate-400">
           <Info className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Entry not found</h2>
        <p className="mt-2 text-sm text-slate-500">This reflection might have been moved or deleted.</p>
        <Link href="/journal" className="mt-6 text-sm font-bold text-emerald-700 hover:underline">Return to Journal</Link>
      </div>
    );
  }

  if (error && !entry) return <EchoErrorState title="Could not load entry" message={error} onRetry={retry} />;
  if (!entry) return null;

  return (
    <div className="mx-auto max-w-7xl pb-20">
      {/* 1. REFINED HEADER AREA */}
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between border-b border-slate-100 pb-8">
        <div className="space-y-4">
          <Link href="/journal" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 transition-colors hover:text-emerald-700">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Pages
          </Link>
          <h1 className="text-4xl font-medium tracking-tight text-slate-900 lg:text-5xl [font-family:var(--font-echo-display)]">
            {entry.title}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
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
          <EchoCard className="overflow-hidden border-none bg-white shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between border-b border-slate-50 px-8 py-4 bg-slate-50/30">
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                <Calendar className="h-3 w-3" /> {entry.createdAt}
              </span>
              <EchoBadge variant={entry.riskBand === "high" || entry.riskBand === "severe" ? "danger" : "default"}>
                {entry.mood}
              </EchoBadge>
            </div>
            
            <div className="p-8">
              <div className="prose prose-slate max-w-none">
                <p className="text-lg leading-[1.8] text-slate-700 whitespace-pre-line font-light">
                  {entry.body}
                </p>
              </div>

              {/* Emotions & Tags inside the main card for context */}
              <div className="mt-12 flex flex-wrap gap-2 border-t border-slate-50 pt-8">
                {entry.emotions.map((emotion) => (
                  <span key={emotion} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700">
                    {emotion}
                  </span>
                ))}
                {entry.tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-500">
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
          <EchoCard className="sticky top-6 border-slate-100 bg-slate-50/50">
            <h2 className="mb-6 text-sm font-bold uppercase tracking-widest text-slate-400">Distress Signal</h2>
            
            <div className="flex flex-col items-center text-center">
              <div
                className="relative grid h-40 w-40 place-items-center rounded-full shadow-inner shadow-black/5"
                style={{
                  background: `conic-gradient(hsl(var(--risk-${entry.riskBand})) ${entry.riskScore * 3.6}deg, #e2e8f0 0deg)`,
                }}
              >
                {/* Inner White Circle */}
                <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white shadow-2xl">
                  <span className="text-4xl font-black text-slate-900 leading-none">{entry.riskScore}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">out of 100</span>
                </div>
              </div>

              <div className="mt-8 space-y-3 px-4">
                <EchoBadge variant={entry.riskBand === "high" || entry.riskBand === "severe" ? "danger" : entry.riskBand === "moderate" ? "warning" : "success"} className="px-4 py-1">
                  Band: {entry.riskBand}
                </EchoBadge>
                <p className="text-xs leading-relaxed text-slate-500">
                  This score is a private reflective signal to help you decide what might support you next. 
                  <span className="mt-2 block font-bold text-slate-400 italic">Not a diagnosis.</span>
                </p>
              </div>
            </div>
          </EchoCard>

          {/* Quick Summary Card */}
          <EchoCard title="Narrative Summary" className="border-slate-100">
            <p className="text-sm leading-relaxed text-slate-600 italic">
              &ldquo;{entry.summary}&rdquo;
            </p>
          </EchoCard>
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