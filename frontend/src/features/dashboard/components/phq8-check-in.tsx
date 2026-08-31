"use client";

import { useState } from "react";
import { assessmentService, type Phq8Result } from "@/services/assessment/assessment.service";

const QUESTIONS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself, or that you have let yourself or your family down",
  "Trouble concentrating on things",
  "Moving or speaking unusually slowly, or being unusually restless",
] as const;

const OPTIONS = ["Not at all", "Several days", "More than half the days", "Nearly every day"] as const;

export function Phq8CheckIn() {
  const [answers, setAnswers] = useState<number[]>(Array(8).fill(-1));
  const [result, setResult] = useState<Phq8Result | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const complete = answers.every((answer) => answer >= 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!complete) return;
    setStatus("submitting");
    setResult(null);
    try {
      setResult(await assessmentService.scorePhq8(answers));
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <details className="rounded-2xl border border-border/70 bg-card p-5 shadow-subtle">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">Optional PHQ-8 self-check</summary>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Answer for the last two weeks. This calculation is not a diagnosis, is not saved as assessment history,
        and does not replace care from a qualified professional.
      </p>
      <form className="mt-4 space-y-4" onSubmit={submit}>
        {QUESTIONS.map((question, questionIndex) => (
          <fieldset key={question} className="rounded-xl border border-border/60 p-3">
            <legend className="px-1 text-sm font-medium text-foreground">{questionIndex + 1}. {question}</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {OPTIONS.map((label, value) => (
                <label key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="radio"
                    name={`phq8-${questionIndex}`}
                    value={value}
                    checked={answers[questionIndex] === value}
                    onChange={() => {
                      setAnswers((current) => current.map((answer, index) => index === questionIndex ? value : answer));
                      setResult(null);
                      setStatus("idle");
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button
          type="submit"
          disabled={!complete || status === "submitting"}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {status === "submitting" ? "Calculating..." : "Calculate private result"}
        </button>
      </form>
      {status === "error" && <p role="alert" className="mt-3 text-sm text-destructive">The self-check could not be calculated. Please try again.</p>}
      {result && (
        <div role="status" className="mt-4 rounded-xl bg-secondary/30 p-4">
          <p className="text-sm font-semibold text-foreground">Score {result.score} of 24 - {result.severity.replaceAll("_", " ")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{result.disclaimer}</p>
        </div>
      )}
    </details>
  );
}
