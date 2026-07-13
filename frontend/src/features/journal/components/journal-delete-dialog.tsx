"use client";

import { EchoDialog } from "@/shared/components/ui/echo-dialog";
import { EchoButton } from "@/shared/components/ui/echo-button";

interface JournalDeleteDialogProps {
  open: boolean;
  isDeleting: boolean;
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function JournalDeleteDialog({ open, isDeleting, title, onConfirm, onCancel }: JournalDeleteDialogProps) {
  return (
    <EchoDialog
      open={open}
      onClose={onCancel}
      title="Delete entry"
      description={`Are you sure you want to delete "${title}"? This action cannot be undone.`}
      size="small"
    >
      <div className="flex justify-end gap-3">
        <EchoButton variant="outline" size="medium" onClick={onCancel} disabled={isDeleting}>
          Cancel
        </EchoButton>
        <EchoButton variant="danger" size="medium" isLoading={isDeleting} onClick={onConfirm}>
          Delete
        </EchoButton>
      </div>
    </EchoDialog>
  );
}
