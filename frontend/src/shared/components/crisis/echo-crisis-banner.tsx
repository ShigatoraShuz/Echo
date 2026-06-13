"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

interface EchoCrisisBannerProps {
  compact?: boolean;
}

/**
 * Crisis support banner — always accessible, never behind a feature flag.
 * Embedded automatically in application shells.
 */
export function EchoCrisisBanner({ compact = false }: EchoCrisisBannerProps) {
  if (compact) {
    return (
      <Link
        href="/crisis"
        className="flex items-center gap-3 rounded-xl border border-danger/30 bg-crisis-soft px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-danger/10"
      >
        <ShieldAlert className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
        <span>Crisis support</span>
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-danger/30 bg-crisis-soft p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-crisis text-danger-foreground">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Immediate support is available</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            If you may be in danger, contact emergency services or a crisis line now. ECHO is not a diagnostic tool.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link
          href="/crisis"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-crisis px-5 text-sm font-semibold text-danger-foreground shadow-subtle transition hover:bg-crisis/90 focus-visible:ring-4 focus-visible:ring-ring/20"
        >
          Get crisis support
        </Link>
        <Link
          href="/crisis-help"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border/70 bg-card px-5 text-sm font-semibold text-foreground shadow-subtle transition hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring/20"
        >
          View resources
        </Link>
      </div>
    </div>
  );
}
