"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getJournalService } from "@/services/journal/journal-service.factory";
import { journalMedia, type JournalAttachment } from "@/services/journal/journal-media";
import type { JournalDraft } from "../model/journal.model";
import { JournalImages } from "../components/journal-images";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";
export function JournalDraftsView() {
  const [draft, setDraft] = useState<JournalDraft | null>(null),
    [images, setImages] = useState<JournalAttachment[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    let active = true;
    void getJournalService()
      .getDraft("current")
      .then(async (result) => {
        if (!active) return;
        if (!result.success) throw Error(result.error.message);
        setDraft(result.data);
        if (result.data) {
          const media = await journalMedia.list(result.data.id, true);
          if (active) setImages(media);
        }
      })
      .catch(() => {
        if (active) setError("Drafts could not be loaded. Reload to retry.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function remove() {
    if (!draft) return;
    setLoading(true);
    try {
      const result = await getJournalService().deleteDraft(draft.id);
      if (!result.success) throw Error(result.error.message);
      setDraft(null);
      setImages([]);
      setConfirm(false);
    } catch {
      setError("The draft could not be deleted. Please retry.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-primary">Your private journal</p>
        <h1 className="font-serif text-4xl">Unfinished pages</h1>
        <p className="mt-3 text-muted-foreground">
          Your current draft stays here until you submit it. Pick up where you left off.
        </p>
      </header>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <div role="status" className="h-48 animate-pulse rounded-3xl bg-secondary motion-reduce:animate-none">
          Loading draft…
        </div>
      ) : draft ? (
        <article className="space-y-4 rounded-3xl border bg-card p-6 shadow-sm">
          <JournalImages items={images} />
          <time dateTime={draft.updatedAt}>Last edited {new Date(draft.updatedAt).toLocaleString()}</time>
          <h2 className="font-serif text-2xl">{draft.title || "A thought in progress"}</h2>
          <p className="whitespace-pre-wrap">{draft.body.slice(0, 250) || "Your page is ready for a first thought."}</p>
          <div className="flex gap-4">
            <Link href="/journal/new" className="echo-button-primary">
              Resume draft
            </Link>
            <button onClick={() => setConfirm(true)} className="echo-button-secondary">
              Delete draft
            </button>
          </div>
        </article>
      ) : (
        <div className="rounded-3xl bg-secondary/50 p-8">
          <h2 className="text-xl">A little room for your next thought</h2>
          <p className="my-3">There are no unfinished pages.</p>
          <Link href="/journal/new" className="echo-button-primary">
            Start a reflection
          </Link>
        </div>
      )}
      <Link href="/journal" className="block underline">
        Return to journal history
      </Link>
      <EchoDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this unfinished page?"
        description="This removes its private text and images."
      >
        <button disabled={loading} onClick={() => void remove()} className="echo-button-primary">
          Delete draft
        </button>
      </EchoDialog>
    </div>
  );
}
