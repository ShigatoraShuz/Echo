"use client";
import { useState } from "react";

interface RenameDialogProps {
  isOpen: boolean;
  currentTitle: string;
  onClose: () => void;
  onRename: (title: string) => void;
  isRenaming: boolean;
}

export function BuddyRenameDialog({ isOpen, currentTitle, onClose, onRename, isRenaming }: RenameDialogProps) {
  const [title, setTitle] = useState(currentTitle);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) { setError("Title cannot be empty"); return; }
    if (trimmed.length > 100) { setError("Title is too long"); return; }
    setError(null);
    onRename(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-foreground">Rename conversation</h2>
        <div className="mt-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            autoFocus
          />
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/60">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={isRenaming} className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {isRenaming ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
