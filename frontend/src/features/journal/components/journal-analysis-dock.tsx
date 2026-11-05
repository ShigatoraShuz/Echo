"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Leaf,
  Sparkles,
  ShieldCheck,
  Brain,
  Activity,
  ClipboardList,
  ScanFace,
} from "lucide-react";
import type {
  JournalAnalysisAvailability,
  JournalSubmissionResponse,
} from "@echo/contracts";
import type { JournalAnalysis } from "../model/journal.model";
import { AnalysisStatusExperience } from "./analysis-status-experience";
import dynamic from "next/dynamic";
const JournalAnalysisPanel = dynamic(() => import("./journal-analysis-panel").then(m => m.JournalAnalysisPanel), { loading: () => <p role="status" className="text-sm text-muted-foreground">Loading saved report…</p> });
import { LocalFaceResult } from "./local-face-result";

const tabs = ["Overview", "Emotions", "PHQ-8", "Face"] as const;
const criteria: Record<string, string> = {
  anhedonia: "Interest",
  depressed_mood: "Feeling down",
  sleep: "Sleep",
  fatigue: "Energy",
  appetite: "Appetite",
  worthlessness_guilt: "Self-worth",
  concentration: "Concentration",
  psychomotor: "Movement",
};

export function JournalAnalysisDock({
  journalId,
  enabled,
  analysis,
  availability,
  onRetry,
  capture,
  initialSubmission,
  saving = false,
  finalizing = false,
}: {
  journalId?: string;
  enabled: boolean;
  analysis?: JournalAnalysis | null;
  availability?: JournalAnalysisAvailability | null;
  onRetry?: () => void;
  capture?: ReactNode;
  initialSubmission?: JournalSubmissionResponse | null;
  saving?: boolean;
  finalizing?: boolean;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const submission = useMemo<JournalSubmissionResponse | null>(
    () =>
      initialSubmission ?? (journalId && availability?.jobId
        ? {
            journalId,
            analysisJobId: availability.jobId,
            status: "queued",
            facialStatus: "not_requested",
          }
        : null),
    [initialSubmission, journalId, availability?.jobId],
  );
  const result = analysis?.result;
  const native =
    result &&
    (result.schemaVersion === "echo-journal-analysis-v2" ||
      result.schemaVersion === "echo-journal-analysis-v3") &&
    !result.isSimulated
      ? result
      : null;
  const screening =
    native?.schemaVersion === "echo-journal-analysis-v3"
      ? native.journalScreening
      : null;
  return (
    <aside
      className="journal-studio-report"
      aria-label="Journal analysis workspace"
    >
      <header className="journal-report-heading">
        <span className="journal-report-emblem">
          <Leaf size={24} aria-hidden="true" />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.22em] text-primary">
            Private reflection studio
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-echo-display)] text-3xl">
            Your ECHO perspective
          </h2>
        </div>
        <Sparkles
          className="ml-auto shrink-0 text-primary/50"
          size={20}
          aria-hidden="true"
        />
      </header>
      <div className="journal-report-body">
        {finalizing && <p role="status" className="mb-4 text-sm text-muted-foreground">Reflection saved. Finishing its optional attachments…</p>}
        {saving ? (
          <div className="journal-report-idle" role="status" aria-live="polite">
            <div className="journal-idle-orbit"><Leaf size={30} aria-hidden="true" /></div>
            <h3 className="font-[family-name:var(--font-echo-display)] text-2xl">Saving your reflection</h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">Your live model progress will appear here as soon as your reflection is saved.</p>
          </div>
        ) : capture ? (
          capture
        ) : availability?.reason === "PROCESSOR_DISABLED" ||
          availability?.reason === "PROCESSING_FAILED" ? (
          <div className="rounded-2xl border border-border p-5">
            <h3 className="font-semibold">
              {availability.reason === "PROCESSOR_DISABLED"
                ? "Processing is unavailable in this environment."
                : "Analysis did not finish."}
            </h3>
            <p className="mt-3 text-sm text-muted-foreground">
              A failed result is not a low distress score. Your reflection
              remains saved.
            </p>
            <button
              type="button"
              className="echo-button-secondary mt-4"
              onClick={onRetry}
            >
              Check analysis status
            </button>
          </div>
        ) : native ? (
          <>
            {native.supportReviewRequired && (
              <p
                role="status"
                className="mb-4 rounded-2xl border border-primary/20 bg-secondary p-4 text-sm"
              >
                This reflection included a support flag.{" "}
                <a className="font-semibold underline" href="/crisis-help">
                  Open support options
                </a>
              </p>
            )}
            <div
              role="tablist"
              aria-label="Analysis report sections"
              className="journal-report-tabs"
            >
              {tabs.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  id={`report-tab-${i}`}
                  aria-controls="journal-report-content"
                  aria-selected={tab === name}
                  tabIndex={tab === name ? 0 : -1}
                  onClick={() => setTab(name)}
                  onKeyDown={(event) => {
                    const next =
                      event.key === "ArrowRight"
                        ? (i + 1) % tabs.length
                        : event.key === "ArrowLeft"
                          ? (i + tabs.length - 1) % tabs.length
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? tabs.length - 1
                              : null;
                    if (next !== null) {
                      event.preventDefault();
                      setTab(tabs[next]);
                      document.getElementById(`report-tab-${next}`)?.focus();
                    }
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <section
              key={tab}
              role="tabpanel"
              id="journal-report-content"
              aria-labelledby={`report-tab-${tabs.indexOf(tab)}`}
              tabIndex={0}
              className="journal-report-pane"
            >
              {tab === "Overview" && (
                <>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Saved model results
                  </p>
                  <h3 className="mt-2 font-[family-name:var(--font-echo-display)] text-4xl capitalize">
                    {native.dominantEmotion}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Strongest emotion signal in this reflection
                  </p>
                  <div className="my-5 grid grid-cols-2 gap-3">
                    <div className="journal-report-stat">
                      <Activity size={17} />
                      <span>Journal category</span>
                      <strong>{native.distressCategory}</strong>
                    </div>
                    <div className="journal-report-stat">
                      <ClipboardList size={17} />
                      <span>PHQ-8 estimate</span>
                      <strong>
                        {screening?.status === "available"
                          ? screening.coverage === 8
                            ? `${screening.total} / 24`
                            : `${screening.coverage} / 8 evidenced`
                          : "Unavailable"}
                      </strong>
                    </div>
                  </div>
                  {analysis?.summary && (
                    <p className="rounded-2xl border border-primary/10 bg-secondary/30 p-4 text-sm leading-7">
                      {analysis.summary}
                    </p>
                  )}
                  <p className="mt-5 text-xs leading-6 text-muted-foreground">
                    Model signals support reflection. They are not diagnoses or
                    measures of your safety. PHQ-8 estimates are experimental
                    and separate from questionnaire scores.
                  </p>
                </>
              )}
              {tab === "Emotions" && (
                <>
                  <h3 className="mb-4 flex items-center gap-2 font-semibold">
                    <Brain size={18} />
                    Emotion patterns
                  </h3>
                  <dl className="space-y-4">
                    {[...native.emotionDistribution]
                      .sort((a, b) => b.value - a.value)
                      .map(({ emotion, value }) => (
                        <div key={emotion}>
                          <div className="mb-1.5 flex justify-between text-sm">
                            <dt className="capitalize">{emotion}</dt>
                            <dd>{Math.round(value * 100)}%</dd>
                          </div>
                          <div className="journal-score-track">
                            <div style={{ width: `${value * 100}%` }} />
                          </div>
                        </div>
                      ))}
                  </dl>
                  <p className="mt-5 text-xs text-muted-foreground">
                    Relative model scores, not a measure of how strongly you
                    feel.
                  </p>
                </>
              )}
              {tab === "PHQ-8" && (
                <>
                  <h3 className="font-semibold">
                    Experimental journal estimate
                  </h3>
                  {screening?.status === "available" && (
                    <p
                      role="status"
                      className="mt-3 rounded-xl border border-primary/15 bg-secondary/40 px-3 py-2 text-xs font-semibold text-primary"
                    >
                      PHQ-8 analysis finished
                    </p>
                  )}
                  <p className="my-3 text-sm">
                    {screening?.status === "available"
                      ? screening.coverage === 8
                        ? `Complete estimate: ${screening.total} / 24`
                        : screening.coverage === 0
                          ? "No criteria evidenced in this entry."
                          : `Partial subtotal: ${screening.subtotal} (${screening.coverage}/8 criteria)`
                      : "No PHQ-8 estimate is available for this entry."}
                  </p>
                  {screening?.status === "available" &&
                    screening.coverage < 8 && (
                      <p className="mb-4 text-xs leading-6 text-muted-foreground">
                        The model ran successfully. This entry does not
                        establish all eight symptom frequencies over the last
                        two weeks, so a complete total cannot be shown. Unknown
                        items are not scored as zero.
                      </p>
                    )}
                  <dl className="grid grid-cols-2 gap-2">
                    {screening?.items &&
                      Object.entries(screening.items).map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-xl border border-border bg-background/50 p-3"
                        >
                          <dt className="text-xs text-muted-foreground">
                            {criteria[key] ?? key}
                          </dt>
                          <dd className="mt-1 text-sm font-semibold">
                            {value === null ? "Not evidenced" : value}
                          </dd>
                        </div>
                      ))}
                  </dl>
                  <p className="mt-4 text-xs leading-6 text-muted-foreground">
                    Missing evidence stays unscored. Only eight evidenced
                    criteria produce a total. Frequency estimates: 0 = not at
                    all; 1 = several days; 2 = more than half the days; 3 =
                    nearly every day. This is not a completed questionnaire or
                    diagnosis.
                  </p>
                </>
              )}
              {tab === "Face" &&
                (journalId ? (
                  <LocalFaceResult entryId={journalId} />
                ) : (
                  <p>No facial result is saved for this entry.</p>
                ))}
            </section>
          </>
        ) : analysis && !result?.isSimulated ? (
          <JournalAnalysisPanel analysis={analysis} />
        ) : submission ? (
          <AnalysisStatusExperience initialSubmission={submission} embedded />
        ) : (
          <div className="journal-report-idle">
            <div className="journal-idle-orbit">
              <Leaf size={30} aria-hidden="true" />
            </div>
            <h3 className="font-[family-name:var(--font-echo-display)] text-2xl">
              {enabled
                ? journalId
                  ? "Your reflection is saved"
                  : "A little space for understanding"
                : "Your words, kept private"}
            </h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {enabled
                ? journalId
                  ? "No model result is available for this entry yet."
                  : "Write freely. When you save, live analysis and your report will unfold here."
                : "Analysis is off. You can still save your reflection without model processing."}
            </p>
            <ul className="journal-idle-stages">
              {[
                { icon: ShieldCheck, label: "Safety check" },
                { icon: Brain, label: "Emotion patterns" },
                { icon: Activity, label: "Journal category" },
                { icon: ClipboardList, label: "PHQ-8 estimate" },
                { icon: ScanFace, label: "Optional face analysis" },
              ].map(({ icon: Icon, label }) => (
                <li key={label}>
                  <Icon size={17} aria-hidden="true" />
                  <span>{label}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wider">
                    {enabled ? "Not started" : "Off"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <footer className="journal-report-footer">
        <ShieldCheck size={14} aria-hidden="true" /> Private results · Saved
        with your reflection
      </footer>
    </aside>
  );
}
