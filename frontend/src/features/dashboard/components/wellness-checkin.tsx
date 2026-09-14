"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { HeartHandshake, Leaf, Sparkles } from "lucide-react";

import type { Phq8Assessment, WellnessStatus } from "@echo/contracts";
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

export function WellnessCheckin() {
  const [status, setStatus] = useState<WellnessStatus | null>(null);

  const [prompt, setPrompt] = useState<Prompt>(null);

  const [answers, setAnswers] = useState<number[]>(Array(8).fill(-1));

  const [saved, setSaved] = useState<Phq8Assessment | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submissionId = useRef<string | null>(null);

  const initialized = useRef(false);
  const urgent = useRef(false);

  const refresh = useCallback(async () => {
    const next = await experienceApi.getWellnessStatus();

    setStatus(next);

    return next;
  }, []);

  const openWelcomeIfNeeded = useCallback(() => {
    if (urgent.current) return;

    if (hasStorageFlag("session", WELCOME_SESSION_KEY)) {
      return;
    }

    setStorageFlag("session", WELCOME_SESSION_KEY);

    setPrompt("welcome");
  }, []);

  useEffect(() => {
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
          setPrompt("phq8");
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
  }, [openWelcomeIfNeeded, refresh]);

  async function save() {
    if (busy || answers.some((answer) => answer < 0)) {
      return;
    }

    setBusy(true);
    setError("");

    submissionId.current ??= crypto.randomUUID();

    try {
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
      <section className="rounded-3xl border border-primary/15 bg-card px-5 py-4" aria-label="Your check-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Leaf className="h-5 w-5 text-primary" aria-hidden="true" />

            <div>
              <h2 className="font-semibold">A moment for you</h2>

              <p className="text-sm text-muted-foreground">
                {status.assessment.due
                  ? "Your PHQ-8 check-in is ready when you are."
                  : `Next check-in: ${new Date(status.assessment.dueAt!).toLocaleDateString()}`}
              </p>
            </div>
          </div>

          {status.assessment.due ? (
            <button className="echo-button-primary rounded-full" onClick={() => setPrompt("phq8")}>
              Take the check-in
            </button>
          ) : null}
        </div>

        {status.urgentJournalId ? (
          <div className="mt-4 rounded-2xl border border-primary/25 bg-secondary p-4" role="status">
            <p className="font-semibold">Support is available right now.</p>

            <p className="mt-1 text-sm">
              A safety signal paused your journal analysis. This is not a diagnosis. If you feel unsafe, reach someone
              who can stay with you.
            </p>

            <Link className="mt-3 inline-flex font-semibold underline" href="/crisis">
              Open crisis support
            </Link>
          </div>
        ) : null}

        {status.support.eligible ? (
          <button
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary underline"
            onClick={async () => {
              try {
                const result = await experienceApi.claimSupportPrompt();

                if (result.show) {
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

        {status.assessment.history.length > 0 ? (
          <details className="mt-3 text-sm">
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
      </section>

      <EchoDialog
        open={prompt === "phq8"}
        onClose={close}
        title={saved ? "Your check-in is saved" : "How have the last two weeks felt?"}
        description="PHQ-8 is a screening tool, not a diagnosis. You can pause and return from your dashboard."
        size="large"
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
            <p className="mb-5 text-sm">
              Over the last 2 weeks, how often have you been bothered by any of the following problems?
            </p>

            <div className="space-y-6">
              {questions.map((question, index) => (
                <fieldset key={question} disabled={busy}>
                  <legend className="mb-2 text-sm font-medium">
                    {index + 1}. {question}
                  </legend>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {choices.map((choice, value) => (
                      <label
                        key={choice}
                        className={`flex min-h-14 cursor-pointer items-start gap-2 rounded-xl border p-3 text-xs ${
                          answers[index] === value ? "border-primary bg-secondary" : "border-border"
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
                          className="mt-0.5 accent-primary"
                        />

                        {choice}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>

            <p className="mt-5 text-xs text-muted-foreground">
              Your answers are saved privately with your account. This questionnaire does not assess immediate safety.
            </p>

            {error ? (
              <p role="alert" className="mt-3 text-sm">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button className="echo-button-primary" disabled={busy || answers.some((answer) => answer < 0)}>
                {busy ? "Saving…" : "Save check-in"}
              </button>

              <button type="button" className="echo-button-secondary" onClick={close} disabled={busy}>
                Later
              </button>

              <Link href="/crisis" className="self-center text-sm underline">
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
