"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HeartHandshake, Leaf, Sparkles, X } from "lucide-react";

import { scorePhq8, type Phq8Assessment, type WellnessStatus } from "@echo/contracts";
import { experienceApi } from "@/services/experience/experience-api";
import { EchoDialog } from "@/shared/components/ui/echo-dialog";

// Standard PHQ-8 wording; source and interpretation notes: docs/wine-app-updates.md.
const questions = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
  "Trouble concentrating on things, such as reading the newspaper or watching television",
  "Moving or speaking so slowly that other people could have noticed — or the opposite, being so fidgety or restless that you have been moving around a lot more than usual",
];

const choices = ["Not at all", "Several days", "More than half the days", "Nearly every day"];

const WELCOME_SESSION_KEY = "echo.dashboard.welcome-shown";

const AI_INTRO_SEEN_KEY = "echo.dashboard.ai-intro-seen";

const previewStatus: WellnessStatus = {
  assessment: { due: true, dueAt: null, intervalDays: 7, history: [] },
  support: { eligible: false, count: 0, windowDays: 14 },
  urgentJournalId: null,
};

type Prompt = "phq8" | "support" | "welcome" | "ai-intro" | null;

function hasStorageFlag(scope: "local" | "session", key: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const storage = scope === "local" ? window.localStorage : window.sessionStorage;

    return storage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function setStorageFlag(scope: "local" | "session", key: string): void {
  if (typeof window === "undefined") return;

  try {
    const storage = scope === "local" ? window.localStorage : window.sessionStorage;

    storage.setItem(key, "true");
  } catch {
    // Storage may be unavailable in restrictive browser contexts.
  }
}

export function WellnessCheckin({ preview = false }: { preview?: boolean }) {
  const [status, setStatus] = useState<WellnessStatus | null>(preview ? previewStatus : null);

  const [prompt, setPrompt] = useState<Prompt>(null);

  const [answers, setAnswers] = useState<number[]>(Array(8).fill(-1));

  const [saved, setSaved] = useState<Phq8Assessment | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);

  const submissionId = useRef<string | null>(null);
  const dockTrigger = useRef<HTMLButtonElement>(null);

  const initialized = useRef(false);
  const urgent = useRef(false);

  useEffect(() => setMounted(true), []);

  const refresh = useCallback(async () => {
    if (preview) return previewStatus;
    const next = await experienceApi.getWellnessStatus();

    setStatus(next);

    return next;
  }, [preview]);

  const openWelcomeIfNeeded = useCallback(() => {
    if (urgent.current) return;

    if (hasStorageFlag("session", WELCOME_SESSION_KEY)) {
      return;
    }

    setStorageFlag("session", WELCOME_SESSION_KEY);

    setPrompt("welcome");
  }, []);

  useEffect(() => {
    if (preview) return;
    let active = true;

    void refresh()
      .then((next) => {
        if (!active || initialized.current) {
          return;
        }

        initialized.current = true;

        if (next.urgentJournalId || urgent.current) {
          return;
        }

        if (next.assessment.due) {
          return;
        }

        if (next.support.eligible) {
          void experienceApi
            .claimSupportPrompt()
            .then((result) => {
              if (!active || urgent.current) {
                return;
              }

              if (result.show) {
                setPrompt("support");
                return;
              }

              openWelcomeIfNeeded();
            })
            .catch(() => {
              if (!active) return;

              setError("Support suggestions could not be loaded. Find Help is always available.");

              openWelcomeIfNeeded();
            });

          return;
        }

        openWelcomeIfNeeded();
      })
      .catch(() => {
        if (active) {
          setError("Your check-in could not be loaded. Please try again.");
        }
      });

    const completed = () => {
      void refresh().catch(() => {});
    };

    window.addEventListener("echo:analysis-completed", completed);

    const safety = () => {
      urgent.current = true;
      setPrompt(null);
      completed();
    };

    window.addEventListener("echo:safety-support", safety);

    return () => {
      active = false;

      window.removeEventListener("echo:analysis-completed", completed);

      window.removeEventListener("echo:safety-support", safety);
    };
  }, [openWelcomeIfNeeded, preview, refresh]);

  async function save() {
    if (busy || answers.some((answer) => answer < 0)) {
      return;
    }

    setBusy(true);
    setError("");

    submissionId.current ??= crypto.randomUUID();

    try {
      if (preview) {
        const completedAt = new Date().toISOString();
        const assessment: Phq8Assessment = {
          id: submissionId.current,
          ...scorePhq8(answers),
          completedAt,
        };
        setSaved(assessment);
        setStatus({
          ...previewStatus,
          assessment: {
            due: false,
            dueAt: new Date(Date.parse(completedAt) + 7 * 86_400_000).toISOString(),
            intervalDays: 7,
            history: [assessment],
          },
        });
        return;
      }

      const result = await experienceApi.savePhq8({
        submissionId: submissionId.current,
        responses: answers,
      });

      setSaved(result);
      await refresh();
    } catch {
      setError("We could not confirm your check-in was saved. Your answers are still here; please retry.");
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    if (!busy) {
      setPrompt(null);
    }
  };

  const continueFromWelcome = () => {
    if (urgent.current || hasStorageFlag("local", AI_INTRO_SEEN_KEY)) {
      setPrompt(null);
      return;
    }

    setPrompt("ai-intro");
  };

  const completeAiIntro = () => {
    setStorageFlag("local", AI_INTRO_SEEN_KEY);

    setPrompt(null);
  };

  const closeDock = () => {
    dockTrigger.current?.focus();
    setDockOpen(false);
  };

  if (!status) {
    return error ? (
      <p role="status" className="rounded-2xl border border-border bg-card p-4 text-sm">
        {error}{" "}
        <button
          className="underline"
          onClick={() => {
            void refresh()
              .then(() => setError(""))
              .catch(() => {});
          }}
        >
          Retry
        </button>
      </p>
    ) : null;
  }

  return (
    <>
      {status.urgentJournalId ? (
        <section className="rounded-2xl border border-primary/25 bg-secondary p-4" role="status">
          <p className="font-semibold">Support is available right now.</p>

          <p className="mt-1 text-sm">
            A safety signal paused your journal analysis. This is not a diagnosis. If you feel unsafe, reach someone
            who can stay with you.
          </p>

          <Link className="mt-3 inline-flex font-semibold underline" href="/crisis">
            Open crisis support
          </Link>
        </section>
      ) : null}

      {mounted && !status.urgentJournalId ? createPortal(
        <aside
          className="echo-checkin-dock fixed right-0 top-28 z-[250] flex max-h-[calc(100dvh-8rem)] w-[min(22rem,calc(100vw-0.75rem))] rounded-l-2xl border border-primary/15 bg-card shadow-xl transition-transform duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:top-1/3 sm:max-h-[calc(66dvh-1rem)]"
          style={{ transform: dockOpen ? "translateX(0)" : "translateX(calc(100% - 3rem))" }}
          aria-label="Your check-in"
          onMouseEnter={() => setDockOpen(true)}
          onMouseLeave={(event) => {
            if (!event.currentTarget.contains(document.activeElement)) setDockOpen(false);
          }}
          onFocusCapture={() => setDockOpen(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setDockOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeDock();
          }}
        >
          <button
            ref={dockTrigger}
            type="button"
            className="flex w-12 shrink-0 flex-col items-center justify-center gap-2 rounded-l-2xl bg-primary py-4 text-xs font-semibold text-primary-foreground outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
            aria-label="Open check-in panel"
            aria-controls="echo-checkin-panel"
            aria-expanded={dockOpen}
            onClick={() => setDockOpen(true)}
          >
            <Leaf className="h-5 w-5" aria-hidden="true" />
            <span className="[writing-mode:vertical-rl]">Check-in</span>
          </button>

          <div id="echo-checkin-panel" className="min-w-0 flex-1 overflow-y-auto p-4" inert={!dockOpen} aria-hidden={!dockOpen}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">A moment for you</h2>
                <p className="mt-1 text-xs text-[var(--landing-muted)]">
                  {status.assessment.due
                    ? "Your PHQ-8 check-in is ready when you are."
                    : `Next check-in: ${new Date(status.assessment.dueAt!).toLocaleDateString()}`}
                </p>
              </div>
              <button type="button" className="rounded-full p-1 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close check-in panel" onClick={closeDock}>
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {status.assessment.due ? (
              <button className="echo-button-primary mt-4 rounded-full" onClick={() => { closeDock(); setPrompt("phq8"); }}>
                Take the check-in
              </button>
            ) : null}

            {status.support.eligible ? (
              <button
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary underline"
                onClick={async () => {
                  try {
                    const result = await experienceApi.claimSupportPrompt();

                    if (result.show) {
                      closeDock();
                      setPrompt("support");
                    }
                  } catch {
                    setError("Please try again. Find Help remains available.");
                  }
                }}
              >
                <HeartHandshake className="h-4 w-4" aria-hidden="true" />
                Explore support for recent patterns
              </button>
            ) : null}

            {error ? <p className="mt-3 text-xs text-destructive" role="alert">{error}</p> : null}

            {status.assessment.history.length > 0 ? (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-muted-foreground">Your screening history</summary>

                <ol className="mt-2 space-y-2">
                  {status.assessment.history.map((item) => (
                    <li key={item.id} className="flex flex-wrap justify-between gap-2 border-t border-border pt-2">
                      <time>{new Date(item.completedAt).toLocaleDateString()}</time>

                      <span>
                        {item.score}/24 · {item.severity.replaceAll("_", " ")}
                      </span>
                    </li>
                  ))}
                </ol>

                <p className="mt-2 text-xs text-muted-foreground">
                  Self-reported screening results, separate from AI journal estimates. Not a diagnosis.
                </p>
              </details>
            ) : null}
          </div>
        </aside>,
        document.body,
      ) : null}

      <EchoDialog
        open={prompt === "phq8"}
        onClose={close}
        title={saved ? (preview ? "Preview check-in complete" : "Your check-in is saved") : "How have the last two weeks felt?"}
        description="PHQ-8 is a screening tool, not a diagnosis. You can pause and return from your dashboard."
        size="large"
        className={saved ? undefined : "md:max-w-4xl"}
      >
        {saved ? (
          <div className="space-y-4">
            <p className="font-serif text-3xl">
              {saved.score}
              <span className="text-base text-muted-foreground"> / 24</span>
            </p>

            <p>
              Screening band: <strong>{saved.severity.replaceAll("_", " ")}</strong>.
            </p>

            <p className="text-sm text-muted-foreground">
              This score reflects your answers today. A qualified professional can help you understand what it means for
              you.
            </p>

            <Link href="/support/find-help" className="echo-button-secondary">
              Find Help
            </Link>

            <button onClick={close} className="echo-button-primary ml-2">
              Continue
            </button>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm leading-6">
                Over the last 2 weeks, how often have you been bothered by any of the following problems?
              </p>
              <p
                role="status"
                aria-live="polite"
                className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"
              >
                {answers.filter((answer) => answer >= 0).length} of {questions.length} answered
              </p>
            </div>

            <div className="sticky top-0 z-10 grid grid-cols-4 gap-1.5 border-b border-border bg-card pb-2 pt-2 text-center text-xs font-semibold leading-4 text-foreground md:grid-cols-[minmax(0,2.5fr)_repeat(4,minmax(0,1fr))] md:gap-2">
              <span className="hidden text-left md:block">Question</span>
              {choices.map((choice) => (
                <span key={choice} className="text-center">{choice}</span>
              ))}
            </div>

            <div>
              {questions.map((question, index) => (
                <fieldset
                  key={question}
                  disabled={busy}
                  className="grid grid-cols-4 gap-1.5 border-b border-border/70 py-2.5 last:border-b-0 md:grid-cols-[minmax(0,2.5fr)_repeat(4,minmax(0,1fr))] md:items-center md:gap-2 md:py-3"
                >
                  <legend className="sr-only">{index + 1}. {question}</legend>
                  <span aria-hidden="true" className="col-span-4 text-sm font-medium leading-5 md:col-span-1">
                    <span className="mr-2 text-primary">{index + 1}.</span>{question}
                  </span>
                  {choices.map((choice, value) => (
                    <label
                      key={choice}
                      className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-1 py-2 transition-colors focus-within:ring-2 focus-within:ring-primary/40 ${
                        answers[index] === value ? "border-primary bg-secondary" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`phq8-${index}`}
                        value={value}
                        checked={answers[index] === value}
                        required
                        onChange={() => {
                          submissionId.current = null;

                          setAnswers((current) => current.map((answer, i) => (i === index ? value : answer)));
                        }}
                        className="h-4 w-4 shrink-0 accent-primary"
                      />
                      <span className="sr-only">{choice}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>

            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {preview
                ? "Preview only: your answers stay on this page and are not saved. This questionnaire does not assess immediate safety."
                : "When you save, your answers are stored privately with your account. This questionnaire does not assess immediate safety."}
            </p>

            {error ? (
              <p role="alert" className="mt-3 text-sm">
                {error}
              </p>
            ) : null}

            <div className="sticky bottom-[-1.5rem] z-10 -mx-6 -mb-6 mt-4 flex flex-wrap items-center gap-2 border-t border-border bg-card px-6 pb-6 pt-3 md:bottom-0 md:mx-0 md:mb-0 md:px-0 md:pb-3">
              <button className="echo-button-primary" disabled={busy || answers.some((answer) => answer < 0)}>
                {busy ? "Saving…" : "Save check-in"}
              </button>

              <button type="button" className="echo-button-secondary" onClick={close} disabled={busy}>
                Later
              </button>

              <Link
                href="/crisis"
                className="w-full text-center text-sm underline underline-offset-2 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:ml-auto sm:w-auto"
              >
                Need help now?
              </Link>
            </div>
          </form>
        )}
      </EchoDialog>

      <EchoDialog
        open={prompt === "support"}
        onClose={close}
        title="You deserve support beyond this space"
        description="Recent journal estimates suggest that things may have felt difficult more than once. These patterns are not a diagnosis."
      >
        <p className="text-sm leading-6">
          Consider talking with a mental health professional or someone you trust. You can choose what feels manageable;
          ECHO will not contact anyone for you.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/support/find-help" className="echo-button-primary" onClick={close}>
            Find Help
          </Link>

          <Link href="/settings" className="echo-button-secondary" onClick={close}>
            Trusted support contact
          </Link>

          <button className="echo-button-secondary" onClick={close}>
            Continue
          </button>
        </div>
      </EchoDialog>

      <EchoDialog
        open={prompt === "welcome"}
        onClose={close}
        title="Welcome back to ECHO"
        description="A quiet place to check in, reflect, and take things at your own pace."
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-primary/15 bg-secondary/40 p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-background text-primary">
                <Leaf className="h-5 w-5" aria-hidden="true" />
              </span>

              <div>
                <p className="font-semibold text-foreground">Take the day as it comes.</p>

                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  A few honest words, a quiet breath, or simply being here is enough. You are always in control of what
                  you choose to share.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="echo-button-primary" onClick={continueFromWelcome}>
              Continue
            </button>

            <button type="button" className="echo-button-secondary" onClick={close}>
              Not now
            </button>
          </div>
        </div>
      </EchoDialog>

      <EchoDialog
        open={prompt === "ai-intro"}
        onClose={close}
        title="AI analysis is optional"
        description="ECHO can help surface patterns from your reflections, but you decide whether to use it."
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-primary/15 bg-secondary/40 p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-background text-primary">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>

              <div className="space-y-2">
                <p className="font-semibold text-foreground">Your journal still belongs to you.</p>

                <p className="text-sm leading-6 text-muted-foreground">
                  AI analysis is optional and is not a diagnosis. Analysis only runs when you choose to use it and when
                  the required privacy, verification, and support safeguards are satisfied.
                </p>

                <p className="text-sm leading-6 text-muted-foreground">
                  You can continue using ECHO&apos;s journal and other non-AI features without enabling AI analysis.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/settings" className="echo-button-primary" onClick={completeAiIntro}>
              Review AI settings
            </Link>

            <button type="button" className="echo-button-secondary" onClick={completeAiIntro}>
              Got it
            </button>

            <button
              type="button"
              className="text-sm font-semibold text-muted-foreground underline underline-offset-4"
              onClick={close}
            >
              Maybe later
            </button>
          </div>
        </div>
      </EchoDialog>
    </>
  );
}
