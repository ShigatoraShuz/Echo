"use client";

import Link from "next/link";
import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Trash2, Tag, Info, ImagePlus, Pencil, Check, X } from "lucide-react";
import { useJournalDetailViewModel } from "../view-model/use-journal-detail-view-model";
import { JournalAnalysisDock } from "../components/journal-analysis-dock";
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
  const {
    entry,
    analysis,
    analysisAvailability,
    isLoading,
    isDeleting,
    isExporting,
    showDeleteDialog,
    error,
    notFound,
    deleteEntry,
    saveEdit, isSavingEdit, editError,
    exportEntry,
    openDeleteDialog: setShowDeleteDialog,
    retry,
    addPhotos,
    photoUploadError,
    uploadingPhotos,
  } = useJournalDetailViewModel(id);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  useEffect(() => { setEditing(false); }, [id]);

  const handleAddPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void addPhotos(files);
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
        <Link href="/journal" className="mt-6 text-sm font-bold text-primary hover:underline">
          Return to Journal
        </Link>
      </div>
    );
  }

  if (error && !entry) return <EchoErrorState title="Could not load entry" message={error} onRetry={retry} />;
  if (!entry) return null;

  const createdAt = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "short" }).format(
    new Date(entry.createdAt),
  );
  const hasPhotos = (entry.images?.length ?? 0) > 0;
  const hasLabels = entry.emotions.length > 0 || entry.tags.length > 0;
  const photoControls = (
    <>
      {(entry.images?.length ?? 0) < 5 && (
        <label className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-primary/15 bg-white/75 px-4 text-sm font-semibold text-primary transition-colors hover:bg-[#edf3ea] focus-within:ring-4 focus-within:ring-primary/20">
          <ImagePlus className="h-4 w-4" aria-hidden="true" />{" "}
          {uploadingPhotos ? "Uploading…" : hasPhotos ? "Add more photos" : "Add your photos"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleAddPhotos}
            disabled={uploadingPhotos}
            aria-label="Add photos to reflection"
            className="sr-only"
          />
        </label>
      )}
      {photoUploadError && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {photoUploadError}
        </p>
      )}
    </>
  );

  return (
    <div className="echo-workspace-enter mx-auto min-w-0 journal-studio max-w-[1480px] pb-8 lg:pb-0 [font-family:var(--font-echo-sans)]">
      <nav
        aria-label="Journal entry actions"
        className="mb-5 flex flex-wrap items-center justify-between gap-3 px-1 sm:mb-6"
      >
        <Link
          href="/journal"
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All entries
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? <>
            <EchoButton variant="outline" className="rounded-full" disabled={isSavingEdit} onClick={() => setEditing(false)}><X size={16} aria-hidden="true" /> Cancel edit</EchoButton>
            <EchoButton className="rounded-full" isLoading={isSavingEdit} disabled={!editBody.trim() || !editTitle.trim() || editTitle.length > 200 || editBody.length > 10000}
              onClick={async () => { if (await saveEdit(editTitle, editBody)) setEditing(false); }}><Check size={16} aria-hidden="true" /> Save changes</EchoButton>
          </> : <EchoButton variant="outline" className="rounded-full bg-card/75" onClick={() => { setEditTitle(entry.title); setEditBody(entry.body); setEditing(true); }}><Pencil size={16} aria-hidden="true" /> Edit entry</EchoButton>}
          <EchoButton
            variant="outline"
            onClick={exportEntry}
            isLoading={isExporting}
            className="rounded-full bg-card/75 px-4"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Export
          </EchoButton>
          <EchoButton
            variant="outline"
            onClick={() => setShowDeleteDialog(true)}
            className="rounded-full border-danger/20 bg-card/75 px-4 text-danger hover:bg-crisis-soft"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
          </EchoButton>
        </div>
      </nav>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-danger/30 bg-crisis-soft px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {editing && <div className="mb-4 rounded-2xl border border-primary/15 bg-secondary/40 px-5 py-4 text-sm leading-6 text-muted-foreground">
        Saving changes clears the previous AI and facial analysis for this reflection. A fresh text analysis starts when analysis is enabled. Your photos stay attached.
        {editError && <p role="alert" className="mt-2 text-danger">{editError}</p>}
      </div>}
      <div className="journal-studio-grid">
        <div className="journal-studio-writing">
          <article
            aria-label="Full reflection"
            className="journal-reading-page overflow-hidden rounded-[1.75rem] border border-[#ddd9cb] bg-[#fffdf8] shadow-[0_18px_60px_rgba(36,57,44,.09)]"
          >
            <div className="h-1.5 bg-[linear-gradient(90deg,#b9cebd_0%,#e8e4d7_64%,#d9c8a8_100%)]" aria-hidden="true" />
            <div className="px-5 pb-10 pt-7 sm:px-10 sm:pb-14 sm:pt-10 lg:px-16">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6e0d3] pb-5 text-xs text-muted-foreground">
                <time dateTime={entry.createdAt} className="font-medium tracking-[.08em]">
                  {createdAt}
                </time>
                {!hasPhotos && photoControls}
              </div>

              <header className="max-w-[44rem] pb-2 pt-9 sm:pt-12">
                <p className="text-[11px] font-semibold uppercase tracking-[.22em] text-primary/75">
                  A page from your journal
                </p>
                {editing ? <label className="block text-xs font-semibold uppercase tracking-wider text-primary">Title
                <input aria-label="Edit journal title" value={editTitle} onChange={event => setEditTitle(event.target.value)} maxLength={200} disabled={isSavingEdit} className="mt-3 w-full rounded-2xl border border-primary/20 bg-background p-4 font-serif text-3xl font-normal normal-case tracking-normal text-foreground outline-none focus:ring-2 focus:ring-primary/20" />
              </label> : (              <h1 className="journal-ink-arrive mt-3 break-words text-[clamp(2.25rem,5vw,4rem)] leading-[1.07] tracking-[-.035em] text-foreground [font-family:var(--font-echo-display)]">
                  {entry.title}
                </h1>)}

              </header>

              {hasPhotos && (
                <div className="mt-8 max-w-[42rem] sm:mt-10">
                  <JournalPhotoStack images={entry.images ?? []} />
                  {photoControls}
                </div>
              )}

              <div className="mt-9 max-w-[68ch] border-t border-[#e6e0d3] pt-8 sm:mt-12 sm:pt-10">
                {editing ? <label className="block text-xs font-semibold uppercase tracking-wider text-primary">Your reflection
                  <textarea aria-label="Edit journal reflection" value={editBody} onChange={event => setEditBody(event.target.value)} maxLength={10000} disabled={isSavingEdit} rows={14} className="mt-3 min-h-80 w-full resize-y rounded-2xl border border-primary/20 bg-background p-5 font-serif text-lg font-normal normal-case leading-8 tracking-normal text-foreground outline-none focus:ring-2 focus:ring-primary/20" />
                </label> : (                <p className="journal-ink-arrive whitespace-pre-wrap break-words text-[1.08rem] leading-[1.9] text-foreground/90 sm:text-[1.2rem] [font-family:var(--font-echo-display)]">
                  {entry.body}
                </p>)}

              </div>

              {hasLabels && (
                <div className="mt-10 flex flex-wrap gap-2 border-t border-[#e6e0d3] pt-6">
                  {entry.emotions.map((emotion) => (
                    <span
                      key={emotion}
                      className="rounded-full bg-[#edf3ea] px-3 py-1.5 text-xs font-medium capitalize text-primary"
                    >
                      {emotion}
                    </span>
                  ))}
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#e6e0d3] px-3 py-1.5 text-xs text-muted-foreground"
                    >
                      <Tag className="h-3 w-3" aria-hidden="true" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </article>
        </div>
        <JournalAnalysisDock
          key={`${id}:${entry.updatedAt}`}
          journalId={id}
          enabled={entry.analysisConsent}
          analysis={analysis}
          availability={analysisAvailability}
          onRetry={retry}
        />
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
