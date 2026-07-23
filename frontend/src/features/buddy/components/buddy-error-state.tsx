"use client";
import { WifiOff, AlertCircle, RotateCcw } from "lucide-react";

interface BuddyErrorStateProps {
  title?: string;
  message: string;
  isOffline?: boolean;
  onRetry?: () => void;
}

export function BuddyErrorState({ title, message, isOffline, onRetry }: BuddyErrorStateProps) {
  const Icon = isOffline ? WifiOff : AlertCircle;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" role="alert">
      <span className={grid h-16 w-16 place-items-center rounded-full }>
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-foreground">{title ?? (isOffline ? "You are offline" : "Something went wrong")}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  );
}
