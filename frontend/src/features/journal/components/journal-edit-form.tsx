"use client";
import { useState, useEffect } from "react";
import type { JournalEntry } from "../model/journal.model";

interface JournalEditFormProps {
  entry: JournalEntry;
  onSave: (id: string, updates: { title: string; body: string }) => void;
  onCancel: () => void;
}

export function JournalEditForm({ entry, onSave, onCancel }: JournalEditFormProps) {
  const [title, setTitle] = useState(entry.title);
  const [body, setBody] = useState(entry.body);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(entry.id, { title, body });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/60">Cancel</button>
        <button type="submit" className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">Save changes</button>
      </div>
    </form>
  );
}
