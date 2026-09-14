"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { JournalDraft } from "../model/journal.model";
import { getJournalService } from "@/services/journal/journal-service.factory";

export function JournalDraftsView() {
  const [draft, setDraft] = useState<JournalDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void getJournalService()
      .getDraft("current")
      .then((result) => {
        if (!active) return;
        if (result.success) setDraft(result.data);
        else setError(result.error.message);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError("Your draft could not be loaded. Please reload to retry.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">Your private journal</p>
        <h1 className="mt-2 font-serif text-4xl">Unfinished pages</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your current draft is saved privately. Pick up where you left off.
        </p>
      </header>
      {loading ? (
        <p role="status">Loading your draft…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : draft ? (
        <article className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs text-muted-foreground">Saved {new Date(draft.updatedAt).toLocaleString()}</p>
          <h2 className="mt-3 font-serif text-2xl">{draft.title || "Untitled reflection"}</h2>
          <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{draft.body}</p>
          <Link className="echo-button-primary mt-5 rounded-full" href="/journal/new">
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
