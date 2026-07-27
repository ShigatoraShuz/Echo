"use client";
import { AlertTriangle } from "lucide-react";

interface JournalDeleteDialogProps {
  isOpen: boolean;
  entryTitle: string;
  onClose: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export function JournalDeleteDialog({ isOpen, entryTitle, onClose, onDelete, isDeleting }: JournalDeleteDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-danger/10 text-danger">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-foreground">Delete entry</h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Are you sure you want to delete <span className="font-medium text-foreground">&ldquo;{entryTitle}&rdquo;</span>? This action cannot be undone.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/60">Cancel</button>
          <button type="button" onClick={onDelete} disabled={isDeleting} className="rounded-full bg-danger px-5 py-2 text-sm font-bold text-white hover:bg-danger/90 disabled:opacity-50">
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
