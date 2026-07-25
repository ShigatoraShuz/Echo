"use client";
import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

interface DeletionRequestProps {
  onRequestDeletion: () => Promise<void>;
  isRequesting: boolean;
  hasPendingRequest: boolean;
}

export function DeletionRequestSection({ onRequestDeletion, isRequesting, hasPendingRequest }: DeletionRequestProps) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/[0.03] p-4">
        <AlertTriangle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Delete account</p>
          <p className="text-xs text-muted-foreground">This action will permanently delete your account and all associated data. There is a 30-day recovery window after request.</p>
        </div>
      </div>

      {hasPendingRequest ? (
        <p className="text-sm text-warning">A deletion request is already pending. Check your email for confirmation.</p>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="rounded border-border" />
            I understand this action is irreversible after 30 days
          </label>
          <button type="button" onClick={onRequestDeletion} disabled={!confirmed || isRequesting} className="inline-flex items-center gap-2 rounded-full bg-danger px-5 py-2.5 text-sm font-bold text-white hover:bg-danger/90 disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> {isRequesting ? "Requesting..." : "Request account deletion"}
          </button>
        </div>
      )}
    </div>
  );
}
