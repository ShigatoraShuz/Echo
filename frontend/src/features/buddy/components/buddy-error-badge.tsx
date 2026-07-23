"use client";
import { AlertTriangle } from "lucide-react";

interface BuddyErrorBadgeProps {
  message: string;
  onRetry: () => void;
}

export function BuddyErrorBadge({ message, onRetry }: BuddyErrorBadgeProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-xs" role="alert">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
      <span className="flex-1 text-danger/80">{message}</span>
      <button type="button" onClick={onRetry} className="shrink-0 rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/20">
        Retry
      </button>
    </div>
  );
}
