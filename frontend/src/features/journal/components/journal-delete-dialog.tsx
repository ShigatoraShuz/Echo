"use client";
import { AlertTriangle } from "lucide-react";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";

interface JournalDeleteDialogProps {
  isOpen: boolean;
  entryTitle: string;
  onClose: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  error?: string;
}

export function JournalDeleteDialog({ isOpen, entryTitle, onClose, onDelete, isDeleting, error }: JournalDeleteDialogProps) {
  return (
    <EchoDialog open={isOpen} onClose={onClose} title="Delete entry" size="small" dismissible={!isDeleting}>
      <AlertTriangle className="h-6 w-6 text-danger" aria-hidden="true" />
      <p className="mt-3 text-sm text-muted-foreground">Are you sure you want to delete <span className="font-medium text-foreground">&ldquo;{entryTitle}&rdquo;</span>? This action cannot be undone.</p>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} disabled={isDeleting} className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/60 disabled:opacity-50">Cancel</button>
        <button type="button" onClick={onDelete} disabled={isDeleting} className="rounded-full bg-danger px-5 py-2 text-sm font-bold text-white hover:bg-danger/90 disabled:opacity-50">
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </EchoDialog>
  );
}
