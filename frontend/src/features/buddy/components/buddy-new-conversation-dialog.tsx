"use client";
import { useState } from "react";
import { createConversationSchema } from "../model/buddy.schema";
import type { BuddyMood } from "../model/buddy.model";

interface NewConversationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, mood?: BuddyMood) => void;
  isCreating: boolean;
}

export function BuddyNewConversationDialog({ isOpen, onClose, onCreate, isCreating }: NewConversationDialogProps) {
  const [title, setTitle] = useState("");
  const [mood, setMood] = useState<BuddyMood | "">("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleSubmit() {
    const result = createConversationSchema.safeParse({ title, initialMood: mood || undefined });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setError(null);
    onCreate(title, mood ? (mood as BuddyMood) : undefined);
    setTitle("");
    setMood("");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-foreground">New conversation</h2>
        <p className="mt-1 text-sm text-muted-foreground">Give your conversation a name to find it again.</p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. Evening reflection"
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Current mood (optional)</label>
            <select
              value={mood}
              onChange={(e) => setMood(e.target.value as BuddyMood | "")}
              className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Not sure yet</option>
              <option value="calm">Calm</option>
              <option value="happy">Happy</option>
              <option value="neutral">Neutral</option>
              <option value="sad">Sad</option>
              <option value="anxious">Anxious</option>
              <option value="angry">Angry</option>
            </select>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/60">Cancel</button>
            <button type="button" onClick={handleSubmit} disabled={isCreating} className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {isCreating ? "Creating..." : "Start conversation"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
