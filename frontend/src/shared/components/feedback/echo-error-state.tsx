"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { EchoButton } from "../ui/echo-button";

interface EchoErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export function EchoErrorState({
  title = "Something went wrong",
  message = "We couldn't load this content. Please try again.",
  onRetry,
  className,
  compact = false,
}: EchoErrorStateProps) {
  if (compact) {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl border border-danger/20 bg-danger/5 p-4", className)} role="alert">
        <AlertTriangle className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
        {onRetry && (
          <EchoButton variant="outline" size="small" onClick={onRetry} className="shrink-0">
            Retry
          </EchoButton>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center py-14 text-center", className)} role="alert">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger" aria-hidden="true">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <EchoButton variant="soft" size="medium" onClick={onRetry} className="mt-5">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </EchoButton>
      )}
    </div>
  );
}
