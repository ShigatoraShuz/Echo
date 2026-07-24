"use client";
import { useState } from "react";
import { Info, X } from "lucide-react";

interface InsightsPrivacyBannerProps {
  message?: string;
}

export function InsightsPrivacyBanner({ message = "Insights are generated from your journal entries and mood data. They remain private and are not shared with anyone." }: InsightsPrivacyBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-primary/10 bg-primary/[0.03] p-4 text-sm" role="status">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="flex-1 text-muted-foreground">{message}</p>
      <button type="button" onClick={() => setDismissed(true)} className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-secondary/60" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
