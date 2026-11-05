"use client";
import Link from "next/link";
import { useJournalDraftViewModel } from "../view-model/use-journal-draft-view-model";

export function JournalDraftsView() {
  const { draft, loading, error, retry } = useJournalDraftViewModel();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">Your private journal</p>
        <h1 className="journal-ink-arrive mt-2 text-4xl [font-family:var(--font-echo-display)]">Unfinished pages</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your current draft is saved privately. Pick up where you left off.
        </p>
      </header>
      {loading ? (
        <p role="status">Loading your draft…</p>
      ) : error ? (
        <div role="alert"><p>{error}</p><button type="button" onClick={() => void retry()} className="echo-button-secondary mt-3">Retry opening draft</button></div>
      ) : draft ? (
        <article className="journal-draft-card rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted-foreground">Saved {new Date(draft.updatedAt).toLocaleString()}</p>
          <h2 className="mt-3 text-2xl [font-family:var(--font-echo-display)]">{draft.title || "Untitled reflection"}</h2>
          <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{draft.body}</p>
          <Link className="echo-button-primary mt-5 rounded-full" href="/journal/resume">
            Resume draft
          </Link>
        </article>
      ) : (
        <div className="rounded-3xl border border-dashed border-border p-8">
          <h2 className="font-semibold">No unfinished reflection yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">A few words in the editor will start your next draft.</p>
          <Link className="echo-button-primary mt-5" href="/journal/new">
            Start writing
          </Link>
        </div>
      )}
      <Link className="inline-flex text-sm underline" href="/journal">
        Back to your journal
      </Link>
    </div>
  );
}
