"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronUp, HeartHandshake, Leaf, Minus, X } from "lucide-react";
import {
  journalSubmissionResponseSchema,
  type AnalysisProgress,
  type JournalSubmissionResponse,
} from "@echo/contracts";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser-client";
import { getJournalService } from "@/services/journal/journal-service.factory";
import { TrustedSupportRequest } from "./trusted-support-request";

const STORAGE_KEY = "echo:active-analysis";
const stageLabels: Record<string, string> = {
  queued: "Journal saved",
  waiting_for_provider: "Journal saved",
  safety_checking: "Safety check",
  safety_action_required: "Support is ready",
  analyzing_emotions: "Understanding emotions",
  classifying_distress: "Estimating distress",
  estimating_screening: "Estimating distress",
  generating_recommendation: "Preparing your reflection",
  aggregating_week: "Updating your dashboard",
  retrying: "Trying again safely",
  completed: "Your reflection is ready",
  failed: "Analysis could not be completed",
};

function storedSubmission(): JournalSubmissionResponse | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    const parsed = journalSubmissionResponseSchema.safeParse(value ? JSON.parse(value) : null);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function AnalysisStatusExperience() {
  const [submission, setSubmission] = useState<JournalSubmissionResponse | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [country, setCountry] = useState("");
  const [resources, setResources] = useState<
    Array<{
      id: string;
      resource_name: string;
      organization_name: string;
      phone_number?: string;
      sms_number?: string;
      website_url?: string;
      availability_text?: string;
    }>
  >([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const currentProgress = useRef<AnalysisProgress | null>(null);
  const notifiedJob = useRef<string | null>(null);

  const update = useCallback((next: AnalysisProgress) => {
    const current = currentProgress.current;
    if (current?.jobId === next.jobId && Date.parse(next.updatedAt) < Date.parse(current.updatedAt)) return;
    const monotonic =
      current?.jobId === next.jobId ? { ...next, progress: Math.max(current.progress, next.progress) } : next;
    currentProgress.current = monotonic;
    setProgress(monotonic);
    if (next.status === "completed" && notifiedJob.current !== next.jobId) {
      notifiedJob.current = next.jobId;
      window.dispatchEvent(new Event("echo:analysis-completed"));
    }
  }, []);

  useEffect(() => {
    setSubmission(storedSubmission());
    const listener = (event: Event) => {
      setProgress(null);
      currentProgress.current = null;
      setSubmission((event as CustomEvent<JournalSubmissionResponse>).detail);
      setDismissed(false);
      setMinimized(false);
    };
    window.addEventListener("echo:analysis-submitted", listener);
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = createBrowserSupabaseClient().auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          localStorage.removeItem(STORAGE_KEY);
          setSubmission(null);
          setProgress(null);
          currentProgress.current = null;
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      /* An unconfigured client cannot receive private status. */
    }
    return () => {
      window.removeEventListener("echo:analysis-submitted", listener);
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!submission) return;
    let cancelled = false;
    const service = getJournalService();
    const poll = async () => {
      const result = await service.getAnalysisStatus?.(submission.analysisJobId);
      if (cancelled) return;
      if (result?.success) update(result.data);
      else if (result && ["NOT_FOUND", "UNAUTHORIZED", "FORBIDDEN"].includes(result.error.code)) {
        setSubmission(null);
        setProgress(null);
        currentProgress.current = null;
        localStorage.removeItem(STORAGE_KEY);
      }
    };
    void poll();
    const interval = window.setInterval(() => {
      if (!["completed", "failed"].includes(currentProgress.current?.status ?? "")) void poll();
    }, 5_000);
    let channel: ReturnType<ReturnType<typeof createBrowserSupabaseClient>["channel"]> | undefined;
    try {
      channel = createBrowserSupabaseClient()
        .channel(`analysis-status:${submission.analysisJobId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "analysis_status_projection",
            filter: `job_id=eq.${submission.analysisJobId}`,
          },
          () => {
            void poll();
          },
        )
        .subscribe();
    } catch {
      /* polling remains authoritative fallback */
    }
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (channel) void createBrowserSupabaseClient().removeChannel(channel);
    };
  }, [submission, update]);

  useEffect(() => {
    if (progress?.status !== "safety_action_required") return;
    if (!/^[A-Z]{2}$/.test(country)) {
      setResources([]);
      return;
    }
    let active = true;
    void getJournalService()
      .resolveSupportResources?.(country)
      .then((result) => {
        if (!active) return;
        if (result.success) setResources(result.data);
      });
    return () => {
      active = false;
    };
  }, [progress?.status, country]);

  useEffect(() => {
    if (!submission || minimized || dismissed) return;
    dialogRef.current?.focus();
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMinimized(true);
      if (event.key === "Tab") {
        const elements = dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input,select,[tabindex="0"]',
        );
        if (!elements?.length) {
          event.preventDefault();
          return;
        }
        const first = elements[0],
          last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [submission, minimized, dismissed, progress?.status]);

  if (!submission || dismissed) return null;
  const status = progress?.status ?? submission.status;
  const value = progress?.progress ?? (status === "queued" ? 5 : 0);
  const label = status === "queued" && value >= 70 ? "Trying again safely" : stageLabels[status];
  if (minimized)
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-5 right-5 z-[70] inline-flex items-center gap-3 rounded-full border border-primary/15 bg-card px-4 py-3 text-sm font-semibold text-primary shadow-[0_18px_50px_rgba(20,45,40,.16)] outline-none transition-[transform,box-shadow] duration-150 ease-out focus-visible:ring-4 focus-visible:ring-primary/20 active:scale-[.97]"
      >
        <Leaf className="h-4 w-4" aria-hidden="true" /> {label} <ChevronUp className="h-4 w-4" aria-hidden="true" />
      </button>
    );

  const waiting = status === "waiting_for_provider";
  const complete = status === "completed";
  const failed = status === "failed";
  const safety = status === "safety_action_required";
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-[rgba(16,42,36,.32)] p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="analysis-dialog-title"
        className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-white/70 bg-[linear-gradient(145deg,rgba(255,253,247,.98),rgba(230,239,224,.96))] p-6 shadow-[0_30px_90px_rgba(16,42,36,.22)] outline-none sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            {safety ? (
              <HeartHandshake aria-hidden="true" />
            ) : complete ? (
              <Check aria-hidden="true" />
            ) : (
              <Leaf aria-hidden="true" />
            )}
          </div>
          {!safety && !complete && !failed ? (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setMinimized(true)}
                aria-label="Minimize analysis progress"
                className="grid h-9 w-9 place-items-center rounded-full outline-none hover:bg-secondary focus-visible:ring-4 focus-visible:ring-primary/20"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Close analysis progress"
                className="grid h-9 w-9 place-items-center rounded-full outline-none hover:bg-secondary focus-visible:ring-4 focus-visible:ring-primary/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
        <div className="mt-5" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
            {safety ? "Immediate support" : "Private analysis"}
          </p>
          <h2
            id="analysis-dialog-title"
            className="mt-2 font-[family-name:var(--font-echo-display)] text-3xl font-semibold text-foreground"
          >
            {label}
          </h2>
          {waiting ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Your journal was saved securely. AI insights are not available yet.
            </p>
          ) : null}
          {failed ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Your journal remains saved securely. You can return to it at any time.
            </p>
          ) : null}
          {safety ? (
            <>
              <label className="mt-3 block text-sm">
                Support country code
                <input
                  value={country}
                  maxLength={2}
                  onChange={(event) => setCountry(event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                  placeholder="e.g. PH"
                  className="ml-2 w-24 rounded-lg border border-border bg-card p-2"
                />
              </label>
              <SafetyContent resources={resources} />
              <div className="mt-4">
                <TrustedSupportRequest jobId={submission.analysisJobId} />
              </div>
              <button
                type="button"
                className="echo-button mt-4 border border-border"
                onClick={() => setMinimized(true)}
              >
                Keep support available
              </button>
            </>
          ) : null}
          {!waiting && !complete && !failed && !safety ? (
            <>
              <div
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={value}
                className="mt-6 h-2 overflow-hidden rounded-full bg-primary/10"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out motion-reduce:transition-none"
                  style={{ width: `${value}%` }}
                />
              </div>
              <p className="mt-2 text-right text-xs font-medium text-muted-foreground">{value}%</p>
            </>
          ) : null}
          {complete ? (
            <>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Your private dashboard has been refreshed. Simulated results are labeled clearly.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  onClick={() => {
                    setDismissed(true);
                    localStorage.removeItem(STORAGE_KEY);
                  }}
                  href={`/journal/${submission.journalId}`}
                  className="echo-button bg-primary text-primary-foreground"
                >
                  View full insight
                </Link>
                <Link
                  onClick={() => {
                    setDismissed(true);
                    localStorage.removeItem(STORAGE_KEY);
                  }}
                  href="/dashboard"
                  className="echo-button border border-border bg-card text-foreground"
                >
                  Go to dashboard
                </Link>
              </div>
            </>
          ) : null}
          {failed ? (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="echo-button mt-6 border border-border bg-card text-foreground"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SafetyContent({
  resources,
}: {
  resources: Array<{
    id: string;
    resource_name: string;
    organization_name: string;
    phone_number?: string;
    sms_number?: string;
    website_url?: string;
    availability_text?: string;
  }>;
}) {
  return (
    <div className="mt-4 space-y-4 text-sm leading-6 text-foreground">
      <p>If you may be in immediate danger, contact local emergency services now. ECHO is not an emergency service.</p>
      <div className="rounded-2xl border border-primary/15 bg-card/80 p-4">
        <p className="font-semibold">For the next minute</p>
        <p className="text-muted-foreground">
          Let your exhale be a little longer, name five things you can see, or move closer to someone you trust.
        </p>
      </div>
      {resources.length ? (
        <ul className="space-y-2">
          {resources.map((resource) => (
            <li key={resource.id} className="rounded-2xl border border-border/70 bg-card p-4">
              <p className="font-semibold">{resource.resource_name}</p>
              <p className="text-muted-foreground">
                {resource.organization_name}
                {resource.availability_text ? ` · ${resource.availability_text}` : ""}
              </p>
              <div className="mt-2 flex gap-3">
                {resource.phone_number ? (
                  <a className="font-semibold text-primary underline" href={`tel:${resource.phone_number}`}>
                    Call
                  </a>
                ) : null}
                {resource.sms_number ? (
                  <a className="font-semibold text-primary underline" href={`sms:${resource.sms_number}`}>
                    Text
                  </a>
                ) : null}
                {resource.website_url ? (
                  <a
                    className="font-semibold text-primary underline"
                    href={resource.website_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Website
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Link href="/crisis-help" className="font-semibold text-primary underline">
          Open verified support options
        </Link>
      )}
    </div>
  );
}
