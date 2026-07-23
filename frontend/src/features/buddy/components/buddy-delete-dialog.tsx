"use client";

interface DeleteDialogProps {
  isOpen: boolean;
  conversationTitle: string;
  onClose: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export function BuddyDeleteDialog({ isOpen, conversationTitle, onClose, onDelete, isDeleting }: DeleteDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-foreground">Delete conversation</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Are you sure you want to delete <span className="font-medium text-foreground">&ldquo;{conversationTitle}&rdquo;</span>? This action cannot be undone.
        </p>
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
