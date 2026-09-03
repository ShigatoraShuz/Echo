"use client";

import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getJournalService } from "@/services/journal/journal-service.factory";
import { settingsService } from "@/services/settings";

interface CompletionToast {
  journalId: string;
  title: string;
}

export function AnalysisCompletionToast() {
  const [toast, setToast] = useState<CompletionToast | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const onCompleted = async (event: Event) => {
      const detail = (event as CustomEvent<{ journalId?: string }>).detail;
      if (!detail?.journalId) return;
      try {
        const settings = await settingsService.get();
        if (!settings.notifications.inAppEnabled || !settings.notifications.insightNotificationsEnabled) return;
        const entry = await getJournalService().getEntry(detail.journalId);
        setToast({
          journalId: detail.journalId,
          title: entry.success ? entry.data.title : "Your journal",
        });
      } catch {
        // The persistent bell notification remains the reliable fallback.
      }
    };
    window.addEventListener("echo:analysis-completed", onCompleted);
    return () => {
      window.removeEventListener("echo:analysis-completed", onCompleted);
    };
  }, []);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    const scheduleDismiss = () => {
      clearTimer();
      timerRef.current = window.setTimeout(() => setToast(null), 8_000);
    };
    if (toast) scheduleDismiss();
    const onVisibility = () => {
      if (document.hidden) clearTimer();
      else if (toast) scheduleDismiss();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimer();
    };
  }, [toast]);

  if (!toast) return null;
  return (
    <aside className="analysis-ready-toast fixed bottom-5 right-5 z-[90] w-[min(25rem,calc(100vw-2.5rem))] rounded-[1.4rem] border border-primary/15 bg-card p-4 text-foreground shadow-[0_22px_70px_rgba(16,42,36,.24)]" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Check className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-primary">Analysis ready</p>
          <p className="mt-1 truncate text-sm font-semibold">“{toast.title}”</p>
          <Link href={`/journal/${toast.journalId}`} onClick={() => setToast(null)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary outline-none focus-visible:ring-4 focus-visible:ring-primary/15">
            View analysis <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <button type="button" onClick={() => setToast(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-[transform,background-color] duration-150 ease-out hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 active:scale-[.97]" aria-label="Dismiss analysis notification">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
