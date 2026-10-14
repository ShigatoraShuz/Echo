"use client";

import Link from "next/link";
import { type ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Trash2, Tag, Info, ImagePlus, Sparkles } from "lucide-react";
import { getJournalService } from "@/services/journal/journal-service.factory";
import { useJournalDetailViewModel } from "../view-model/use-journal-detail-view-model";
import { JournalAnalysisPanel } from "../components/journal-analysis-panel";
import { JournalDeleteDialog } from "../components/journal-delete-dialog";
import { JournalPhotoStack } from "../components/journal-photo-stack";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoLoadingState } from "@/shared/components/feedback/echo-loading-state";
import { EchoErrorState } from "@/shared/components/feedback/echo-error-state";

interface JournalDetailViewProps {
  id: string;
}

export function JournalDetailView({ id }: JournalDetailViewProps) {
  const router = useRouter();
  const [photoUploadError, setPhotoUploadError] = useState("");
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const {
    entry, analysis, isLoading, isDeleting, isExporting,
    showDeleteDialog, error, notFound,
    deleteEntry, exportEntry, openDeleteDialog: setShowDeleteDialog, retry,
  } = useJournalDetailViewModel(id);

  const addPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (files.length > 5 - (entry?.images?.length ?? 0) ||
        files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setPhotoUploadError("Choose up to five total JPEG, PNG, or WebP photos, at most 5 MB each.");
      return;
    }
    setPhotoUploadError("");
    setUploadingPhotos(true);
    try {
      for (const file of files) {
        const result = await getJournalService().uploadImage?.(id, crypto.randomUUID(), file);
        if (!result?.success) {
          setPhotoUploadError(result && !result.success ? result.error.message : "Photo upload is unavailable. Please retry.");
          break;
        }
      }
      retry();
    } catch {
      setPhotoUploadError("The photo could not be uploaded. Please retry.");
    } finally {
      setUploadingPhotos(false);
    }
  };

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

  const createdAt = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "short" }).format(new Date(entry.createdAt));
  const hasPhotos = (entry.images?.length ?? 0) > 0;
  const hasLabels = entry.emotions.length > 0 || entry.tags.length > 0;

  return (
    <div className="echo-workspace-enter mx-auto min-w-0 max-w-[980px] pb-10 [font-family:var(--font-echo-sans)]">
      <nav aria-label="Journal entry actions" className="mb-5 flex flex-wrap items-center justify-between gap-3 px-1 sm:mb-6">
        <Link href="/journal" className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All entries
        </Link>
        <div className="flex items-center gap-2">
          <EchoButton variant="outline" onClick={exportEntry} isLoading={isExporting} className="rounded-full bg-card/75 px-4">
            <Download className="h-4 w-4" aria-hidden="true" /> Export
          </EchoButton>
          <EchoButton variant="outline" onClick={() => setShowDeleteDialog(true)} className="rounded-full border-danger/20 bg-card/75 px-4 text-danger hover:bg-crisis-soft">
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
          </EchoButton>
        </div>
      </nav>

      {error && <p role="alert" className="mb-4 rounded-xl border border-danger/30 bg-crisis-soft px-4 py-3 text-sm text-danger">{error}</p>}

      <article aria-label="Full reflection" className="journal-reading-page overflow-hidden rounded-[1.75rem] border border-[#ddd9cb] bg-[#fffdf8] shadow-[0_18px_60px_rgba(36,57,44,.09)]">
        <div className="h-1.5 bg-[linear-gradient(90deg,#b9cebd_0%,#e8e4d7_64%,#d9c8a8_100%)]" aria-hidden="true" />
        <div className="px-5 pb-10 pt-7 sm:px-10 sm:pb-14 sm:pt-10 lg:px-16">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6e0d3] pb-5 text-xs text-muted-foreground">
            <time dateTime={entry.createdAt} className="font-medium tracking-[.08em]">{createdAt}</time>
            <span className="rounded-full border border-primary/15 bg-[#edf3ea] px-3 py-1 text-xs font-semibold capitalize text-primary">{entry.mood}</span>
          </div>

          <header className="max-w-[44rem] pb-2 pt-9 sm:pt-12">
            <p className="text-[11px] font-semibold uppercase tracking-[.22em] text-primary/75">A page from your journal</p>
            <h1 className="journal-ink-arrive mt-3 break-words text-[clamp(2.25rem,5vw,4rem)] leading-[1.07] tracking-[-.035em] text-foreground [font-family:var(--font-echo-display)]">{entry.title}</h1>
          </header>

          <div className="mt-8 max-w-[42rem] sm:mt-10">
            <JournalPhotoStack images={entry.images ?? []} />
            {(entry.images?.length ?? 0) < 5 && (
              <label className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-primary/15 bg-white/75 px-4 text-sm font-semibold text-primary transition-colors hover:bg-[#edf3ea] focus-within:ring-4 focus-within:ring-primary/20">
                <ImagePlus className="h-4 w-4" aria-hidden="true" /> {uploadingPhotos ? "Uploading…" : hasPhotos ? "Add more photos" : "Add your photos"}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void addPhotos(event)} disabled={uploadingPhotos} aria-label="Add photos to reflection" className="sr-only" />
              </label>
            )}
            {photoUploadError && <p role="alert" className="mt-2 text-sm text-danger">{photoUploadError}</p>}
          </div>

          <div className="mt-9 max-w-[68ch] border-t border-[#e6e0d3] pt-8 sm:mt-12 sm:pt-10">
            <p className="journal-ink-arrive whitespace-pre-wrap break-words text-[1.08rem] leading-[1.9] text-foreground/90 sm:text-[1.2rem] [font-family:var(--font-echo-display)]">{entry.body}</p>
          </div>

          {hasLabels && <div className="mt-10 flex flex-wrap gap-2 border-t border-[#e6e0d3] pt-6">
            {entry.emotions.map((emotion) => <span key={emotion} className="rounded-full bg-[#edf3ea] px-3 py-1.5 text-xs font-medium capitalize text-primary">{emotion}</span>)}
            {entry.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-[#e6e0d3] px-3 py-1.5 text-xs text-muted-foreground"><Tag className="h-3 w-3" aria-hidden="true" />{tag}</span>)}
          </div>}
        </div>
      </article>

      <section aria-label="ECHO perspective" className="mt-8 sm:mt-10">
        {analysis ? <>
          <JournalAnalysisPanel analysis={analysis} />
          {analysis.result && analysis.summary && <div className="mt-4 rounded-2xl border border-primary/10 bg-card/80 px-5 py-4 sm:px-6"><h2 className="text-xs font-semibold uppercase tracking-[.14em] text-primary">Narrative summary</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{analysis.summary}</p></div>}
        </> : <div className="rounded-2xl border border-primary/10 bg-card/75 px-5 py-5 sm:px-6"><h2 className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" aria-hidden="true" /> ECHO perspective</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">No completed analysis is available for this entry. Your writing is safely saved; a missing result does not represent a low distress score.</p></div>}
      </section>

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
