"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Check,
  HeartHandshake,
  Leaf,
  Sparkles,
} from "lucide-react";

import type {
  Phq8Assessment,
  WellnessStatus,
} from "@echo/contracts";
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

const choices = [
  "Not at all",
  "Several days",
  "More than half the days",
  "Nearly every day",
];

const WELCOME_SESSION_KEY =
  "echo.dashboard.welcome-shown";

const AI_INTRO_SEEN_KEY =
  "echo.dashboard.ai-intro-seen";

type Prompt =
  | "phq8"
  | "support"
  | "welcome"
  | "ai-intro"
  | null;

function hasStorageFlag(
  scope: "local" | "session",
  key: string,
): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const storage =
      scope === "local"
        ? window.localStorage
        : window.sessionStorage;

    return storage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function setStorageFlag(
  scope: "local" | "session",
  key: string,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const storage =
      scope === "local"
        ? window.localStorage
        : window.sessionStorage;

    storage.setItem(key, "true");
  } catch {
    // Storage may be unavailable in restrictive browser contexts.
  }
}

export function WellnessCheckin() {
  const [status, setStatus] =
    useState<WellnessStatus | null>(null);

  const [prompt, setPrompt] =
    useState<Prompt>(null);

  const [answers, setAnswers] =
    useState<number[]>(Array(8).fill(-1));

  const [saved, setSaved] =
    useState<Phq8Assessment | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submissionId =
    useRef<string | null>(null);

  const initialized =
    useRef(false);

  const urgent = useRef(false);

  const refresh = useCallback(async () => {
    const next =
      await experienceApi.getWellnessStatus();

    setStatus(next);

    return next;
  }, []);

  const openWelcomeIfNeeded =
    useCallback(() => {
      if (urgent.current) {
        return;
      }

      if (
        hasStorageFlag(
          "session",
          WELCOME_SESSION_KEY,
        )
      ) {
        return;
      }

      setStorageFlag(
        "session",
        WELCOME_SESSION_KEY,
      );

      setPrompt("welcome");
    }, []);

  useEffect(() => {
    let active = true;

    void refresh()
      .then((next) => {
        if (
          !active ||
          initialized.current
        ) {
          return;
        }

        initialized.current = true;

        if (
          next.urgentJournalId ||
          urgent.current
        ) {
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
              if (
                !active ||
                urgent.current
              ) {
                return;
              }

              if (result.show) {
                setPrompt("support");
                return;
              }

              openWelcomeIfNeeded();
            })
            .catch(() => {
              if (!active) {
                return;
              }

              setError(
                "Support suggestions could not be loaded. Find Help is always available.",
              );

              openWelcomeIfNeeded();
            });

          return;
        }

        openWelcomeIfNeeded();
      })
      .catch(() => {
        if (active) {
          setError(
            "Your check-in could not be loaded. Please try again.",
          );
        }
      });

    const completed = () => {
      void refresh().catch(() => {});
    };

    window.addEventListener(
      "echo:analysis-completed",
      completed,
    );

    const safety = () => {
      urgent.current = true;
      setPrompt(null);
      completed();
    };

    window.addEventListener(
      "echo:safety-support",
      safety,
    );

    return () => {
      active = false;

      window.removeEventListener(
        "echo:analysis-completed",
        completed,
      );

      window.removeEventListener(
        "echo:safety-support",
        safety,
      );
    };
  }, [openWelcomeIfNeeded, refresh]);

  async function save() {
    if (
      busy ||
      answers.some(
        (answer) => answer < 0,
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");

    submissionId.current ??=
      crypto.randomUUID();

    try {
      const result =
        await experienceApi.savePhq8({
          submissionId:
            submissionId.current,
          responses: answers,
        });

      setSaved(result);
      await refresh();
    } catch {
      setError(
        "We could not confirm your check-in was saved. Your answers are still here; please retry.",
      );
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
    if (
      urgent.current ||
      hasStorageFlag(
        "local",
        AI_INTRO_SEEN_KEY,
      )
    ) {
      setPrompt(null);
      return;
    }

    setPrompt("ai-intro");
  };

  const completeAiIntro = () => {
    setStorageFlag(
      "local",
      AI_INTRO_SEEN_KEY,
    );

    setPrompt(null);
  };

  const answeredCount = answers.filter(
    (answer) => answer >= 0,
  ).length;

  const progressPercentage =
    (answeredCount / questions.length) * 100;

  if (!status) {
    return error ? (
      <p
        role="status"
        className="rounded-2xl border border-border bg-card p-4 text-sm"
      >
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
      <section
        className="rounded-3xl border border-primary/15 bg-card px-5 py-4"
        aria-label="Your check-in"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Leaf
              className="h-5 w-5 text-primary"
              aria-hidden="true"
            />

            <div>
              <h2 className="font-semibold">
                A moment for you
              </h2>

              <p className="text-sm text-muted-foreground">
                {status.assessment.due
                  ? "Your PHQ-8 check-in is ready when you are."
                  : `Next check-in: ${new Date(
                      status.assessment.dueAt!,
                    ).toLocaleDateString()}`}
              </p>
            </div>
          </div>

          {status.assessment.due ? (
            <button
              className="echo-button-primary rounded-full"
              onClick={() =>
                setPrompt("phq8")
              }
            >
              Take the check-in
            </button>
          ) : null}
        </div>

        {status.urgentJournalId ? (
          <div
            className="mt-4 rounded-2xl border border-primary/25 bg-secondary p-4"
            role="status"
          >
            <p className="font-semibold">
              Support is available right now.
            </p>

            <p className="mt-1 text-sm">
              A safety signal paused your journal analysis. This is not a diagnosis. If you feel unsafe, reach someone
              who can stay with you.
            </p>

            <Link
              className="mt-3 inline-flex font-semibold underline"
              href="/crisis"
            >
              Open crisis support
            </Link>
          </div>
        ) : null}

        {status.support.eligible ? (
          <button
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary underline"
            onClick={async () => {
              try {
                const result =
                  await experienceApi.claimSupportPrompt();

                if (result.show) {
                  setPrompt("support");
                }
              } catch {
                setError(
                  "Please try again. Find Help remains available.",
                );
              }
            }}
          >
            <HeartHandshake
              className="h-4 w-4"
              aria-hidden="true"
            />
            Explore support for recent patterns
          </button>
        ) : null}

        {status.assessment.history.length >
        0 ? (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Your screening history
            </summary>

            <ol className="mt-2 space-y-2">
              {status.assessment.history.map(
                (item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap justify-between gap-2 border-t border-border pt-2"
                  >
                    <time>
                      {new Date(
                        item.completedAt,
                      ).toLocaleDateString()}
                    </time>

                    <span>
                      {item.score}/24 ·{" "}
                      {item.severity.replaceAll(
                        "_",
                        " ",
                      )}
                    </span>
                  </li>
                ),
              )}
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
        title={
          saved
            ? "Your check-in is saved"
            : "How have the last two weeks felt?"
        }
        description={
          saved
            ? "A private reflection on how you've been feeling lately."
            : "A gentle eight-question screening about the past two weeks. There are no right or wrong answers."
        }
        size="large"
        className="max-w-[960px]"
      >
        {saved ? (
          <div className="space-y-6 pt-2">
            <div className="relative overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,rgba(143,200,154,0.24),rgba(250,248,238,0.88))] p-6 sm:p-7">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/40 blur-2xl" />

              <div className="relative flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/80 text-primary shadow-sm">
                  <Check
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                    Reflection complete
                  </p>

                  <p className="mt-1 font-serif text-5xl tracking-[-0.04em] text-foreground">
                    {saved.score}
                    <span className="ml-1 text-lg tracking-normal text-muted-foreground">
                      / 24
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#faf9f4] px-5 py-4">
              <p className="text-sm text-muted-foreground">
                Screening band
              </p>

              <p className="mt-1 text-base font-semibold capitalize text-foreground">
                {saved.severity.replaceAll(
                  "_",
                  " ",
                )}
              </p>
            </div>

            <p className="text-sm leading-6 text-muted-foreground">
              This score reflects your answers today. A qualified professional can help you understand what it means for
              you.
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/support/find-help"
                className="echo-button-secondary"
              >
                Find Help
              </Link>

              <button
                onClick={close}
                className="echo-button-primary"
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            className="pt-1"
          >
            {/* HERO / PROGRESS */}
            <div className="relative overflow-hidden rounded-[1.65rem] bg-[linear-gradient(135deg,#edf5eb_0%,#f8f5ea_58%,#fffdf8_100%)] p-5 sm:p-6">
              <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/45 blur-3xl" />
              <div className="absolute -bottom-12 left-1/3 h-32 w-32 rounded-full bg-[#8fc89a]/10 blur-3xl" />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/80 text-primary shadow-sm">
                      <Sparkles
                        className="h-5 w-5"
                        aria-hidden="true"
                      />
                    </div>

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                        Private check-in
                      </p>

                      <h3 className="mt-1 text-base font-semibold tracking-[-0.02em] text-foreground">
                        A little space to check in
                      </h3>

                      <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">
                        Take your time. Choose the answer that feels closest to your experience.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 rounded-full bg-white/75 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
                    {answeredCount} /{" "}
                    {questions.length}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <span>Your progress</span>
                    <span>
                      {Math.round(
                        progressPercentage,
                      )}
                      %
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70 shadow-inner">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#6f985a,#8fc89a)] transition-[width] duration-500 ease-out"
                      style={{
                        width: `${progressPercentage}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* QUESTIONS */}
            <div className="mt-6 space-y-4">
              {questions.map(
                (question, index) => {
                  const selected =
                    answers[index];

                  return (
                    <fieldset
                      key={question}
                      disabled={busy}
                      className="group rounded-[1.45rem] bg-[#faf9f4] p-4 transition-all duration-300 hover:bg-[#f8f7f1] sm:p-5"
                    >
                      <legend className="w-full">
                        <div className="flex items-start gap-3">
                          <span
                            className={[
                              "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black",
                              "transition-all duration-300",
                              selected >= 0
                                ? "bg-primary text-white shadow-[0_6px_18px_rgba(83,103,51,0.20)]"
                                : "bg-[#edf1e8] text-primary",
                            ].join(" ")}
                          >
                            {selected >= 0 ? (
                              <Check
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            ) : (
                              index + 1
                            )}
                          </span>

                          <span className="pt-1 text-sm font-semibold leading-5 tracking-[-0.01em] text-foreground sm:text-[15px]">
                            {question}
                          </span>
                        </div>
                      </legend>

                      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {choices.map(
                          (
                            choice,
                            value,
                          ) => {
                            const isSelected =
                              selected ===
                              value;

                            return (
                              <label
                                key={choice}
                                className={[
                                  "group/choice relative flex min-h-[58px] cursor-pointer items-center gap-3 rounded-xl px-3.5 py-3",
                                  "transition-all duration-200",
                                  "active:scale-[0.985]",
                                  isSelected
                                    ? "bg-[#e8f1e4] shadow-[0_8px_24px_rgba(83,103,51,0.10)]"
                                    : "bg-white hover:-translate-y-0.5 hover:bg-[#f4f7f1]",
                                ].join(" ")}
                              >
                                <input
                                  type="radio"
                                  name={`phq8-${index}`}
                                  value={value}
                                  checked={
                                    isSelected
                                  }
                                  required
                                  onChange={() => {
                                    submissionId.current =
                                      null;

                                    setAnswers(
                                      (
                                        current,
                                      ) =>
                                        current.map(
                                          (
                                            answer,
                                            i,
                                          ) =>
                                            i ===
                                            index
                                              ? value
                                              : answer,
                                        ),
                                    );
                                  }}
                                  className="sr-only"
                                />

                                <span
                                  aria-hidden="true"
                                  className={[
                                    "grid h-5 w-5 shrink-0 place-items-center rounded-full",
                                    "transition-all duration-200",
                                    isSelected
                                      ? "bg-primary shadow-[0_0_0_4px_rgba(83,103,51,0.08)]"
                                      : "bg-white shadow-[inset_0_0_0_1px_rgba(143,154,136,0.65)] group-hover/choice:shadow-[inset_0_0_0_1px_rgba(83,103,51,0.45)]",
                                  ].join(" ")}
                                >
                                  {isSelected ? (
                                    <span className="h-2 w-2 rounded-full bg-white" />
                                  ) : null}
                                </span>

                                <span
                                  className={[
                                    "text-xs leading-4",
                                    isSelected
                                      ? "font-semibold text-foreground"
                                      : "text-muted-foreground",
                                  ].join(" ")}
                                >
                                  {choice}
                                </span>
                              </label>
                            );
                          },
                        )}
                      </div>
                    </fieldset>
                  );
                },
              )}
            </div>

            {/* PRIVACY NOTE */}
            <div className="mt-5 flex items-start gap-3 rounded-[1.35rem] bg-[#f2f3ed] px-4 py-4">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-primary shadow-sm">
                <Leaf
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground">
                  Your reflection stays private
                </p>

                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  Your answers are saved privately with your account. This questionnaire does not assess immediate
                  safety.
                </p>
              </div>
            </div>

            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            ) : null}

            {/* ACTIONS */}
            <div className="sticky bottom-0 z-10 -mx-5 mt-6 border-t border-[#e6e4dc] bg-[#fffdf8]/95 px-5 pb-1 pt-4 backdrop-blur-md sm:-mx-6 sm:px-6">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="echo-button-primary min-w-[150px] rounded-full shadow-[0_10px_24px_rgba(83,103,51,0.16)]"
                  disabled={
                    busy ||
                    answers.some(
                      (answer) =>
                        answer < 0,
                    )
                  }
                >
                  {busy
                    ? "Saving…"
                    : "Save check-in"}
                </button>

                <button
                  type="button"
                  className="echo-button-secondary rounded-full"
                  onClick={close}
                  disabled={busy}
                >
                  Later
                </button>

                <Link
                  href="/crisis"
                  className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline underline-offset-4"
                >
                  Need help now?
                </Link>
              </div>
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
        <p className="pt-1 text-sm leading-6">
          Consider talking with a mental health professional or someone you trust. You can choose what feels manageable;
          ECHO will not contact anyone for you.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/support/find-help"
            className="echo-button-primary"
            onClick={close}
          >
            Find Help
          </Link>

          <Link
            href="/settings"
            className="echo-button-secondary"
            onClick={close}
          >
            Trusted support contact
          </Link>

          <button
            className="echo-button-secondary"
            onClick={close}
          >
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
        <div className="space-y-5 pt-1">
          <div className="rounded-2xl bg-secondary/40 p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-background text-primary">
                <Leaf
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              </span>

              <div>
                <p className="font-semibold text-foreground">
                  Take the day as it comes.
                </p>

                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  A few honest words, a quiet breath, or simply being here is enough. You are always in control of what
                  you choose to share.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="echo-button-primary"
              onClick={
                continueFromWelcome
              }
            >
              Continue
            </button>

            <button
              type="button"
              className="echo-button-secondary"
              onClick={close}
            >
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
        <div className="space-y-5 pt-1">
          <div className="rounded-2xl bg-secondary/40 p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-background text-primary">
                <Sparkles
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              </span>

              <div className="space-y-2">
                <p className="font-semibold text-foreground">
                  Your journal still belongs to you.
                </p>

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
            <Link
              href="/settings"
              className="echo-button-primary"
              onClick={completeAiIntro}
            >
              Review AI settings
            </Link>

            <button
              type="button"
              className="echo-button-secondary"
              onClick={completeAiIntro}
            >
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