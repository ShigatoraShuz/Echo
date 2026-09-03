"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Bot,
  Brain,
  Check,
  ClipboardList,
  ExternalLink,
  FlaskConical,
  HeartHandshake,
  Leaf,
  LockKeyhole,
  Play,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Wind,
  Zap,
} from "lucide-react";
import type { FacialAnalysisStatus } from "@echo/contracts";
import { analysisChecksFor } from "@echo/contracts";
import type { JournalAnalysis } from "../model/journal.model";

export type PreviewState = "processing" | "partial-ready" | "fully-ready" | "safety-attention" | "failure";

const baseEmotionDistribution = [
  { emotion: "joy" as const, value: 0.18 },
  { emotion: "calm" as const, value: 0.35 },
  { emotion: "sadness" as const, value: 0.08 },
  { emotion: "anxiety" as const, value: 0.11 },
  { emotion: "anger" as const, value: 0.05 },
  { emotion: "hope" as const, value: 0.23 },
];

const mockAnalyses: Record<PreviewState, { analysis: JournalAnalysis; facialStatus: FacialAnalysisStatus; progressPercent: number; aggregateStatus: import("@echo/contracts").AnalysisStatus }> = {
  processing: {
    aggregateStatus: "classifying_distress",
    facialStatus: "analyzing",
    progressPercent: 45,
    analysis: {
      id: "analysis-preview-processing",
      entryId: "journal-preview",
      summary: "Understanding your reflection and checking support needs.",
      perspective: "Processing is currently in progress across text and facial streams.",
      moodInsight: "Processing…",
      riskIndication: "Processing…",
      isDemoData: true,
      createdAt: "2026-09-03",
      facialStatus: "analyzing",
      result: undefined,
    },
  },
  "partial-ready": {
    aggregateStatus: "completed",
    facialStatus: "captured_pending_provider",
    progressPercent: 100,
    analysis: {
      id: "analysis-preview-partial",
      entryId: "journal-preview",
      summary: "A calm reflection that notices a small, supportive moment.",
      perspective:
        "You noticed a moment of calm and gave yourself time to stay with it. That pause can be a useful reminder that steadiness is available in small, repeatable moments.",
      moodInsight: "Calm is the strongest signal in this simulated reflection, followed by hope.",
      riskIndication: "Low distress signal with 88% confidence. This is not a diagnosis.",
      isDemoData: true,
      createdAt: "2026-09-03",
      facialStatus: "captured_pending_provider",
      result: {
        schemaVersion: "echo-journal-analysis-v1",
        thresholdVersion: "echo-thresholds-v1",
        providerName: "echo-development-preview",
        modelVersion: "simulated-partial-v1",
        isSimulated: true,
        emotionDistribution: baseEmotionDistribution,
        dominantEmotion: "calm",
        emotionConfidence: 0.86,
        distressBand: "low",
        distressConfidence: 0.88,
        depressiveSymptomRange: { lower: 0, upper: 4 },
        recommendationFeatures: ["paced_breathing"],
        facialExpressionAnalysis: null,
      },
    },
  },
  "fully-ready": {
    aggregateStatus: "completed",
    facialStatus: "completed",
    progressPercent: 100,
    analysis: {
      id: "analysis-preview-ready",
      entryId: "journal-preview",
      summary: "A calm reflection that notices a small, supportive moment.",
      perspective:
        "You noticed a moment of calm and gave yourself time to stay with it. That pause can be a useful reminder that steadiness is available in small, repeatable moments.",
      moodInsight: "Calm is the strongest signal in this simulated reflection, followed by hope.",
      riskIndication: "Low distress signal with 88% confidence. This is not a diagnosis.",
      isDemoData: true,
      createdAt: "2026-09-03",
      facialStatus: "completed",
      result: {
        schemaVersion: "echo-journal-analysis-v1",
        thresholdVersion: "echo-thresholds-v1",
        providerName: "echo-development-preview",
        modelVersion: "simulated-complete-v1",
        isSimulated: true,
        emotionDistribution: baseEmotionDistribution,
        dominantEmotion: "calm",
        emotionConfidence: 0.86,
        distressBand: "low",
        distressConfidence: 0.88,
        depressiveSymptomRange: { lower: 0, upper: 4 },
        recommendationFeatures: ["paced_breathing", "grounding"],
        facialExpressionAnalysis: {
          detectedEmotion: "Calm",
          emotionDistribution: [
            { emotion: "calm", value: 0.72 },
            { emotion: "neutral", value: 0.18 },
            { emotion: "joy", value: 0.1 },
          ],
          confidence: 0.85,
          providerName: "echo-self-hosted-preview",
          modelVersion: "face-blendshapes-v1",
        },
      },
    },
  },
  "safety-attention": {
    aggregateStatus: "safety_action_required",
    facialStatus: "not_requested",
    progressPercent: 15,
    analysis: {
      id: "analysis-preview-safety",
      entryId: "journal-preview",
      summary: "Immediate support is available. We paused reflection analysis.",
      perspective: "Support resources are ready whenever you need someone to reach out to.",
      moodInsight: "Safety check flagged support needs.",
      riskIndication: "High support priority.",
      isDemoData: true,
      createdAt: "2026-09-03",
      facialStatus: "not_requested",
      result: undefined,
    },
  },
  failure: {
    aggregateStatus: "failed",
    facialStatus: "failed",
    progressPercent: 30,
    analysis: {
      id: "analysis-preview-failed",
      entryId: "journal-preview",
      summary: "Analysis could not be completed. Your journal remains safely stored.",
      perspective: "Your private journal entry is intact. Analysis can be retried at any time.",
      moodInsight: "Unavailable",
      riskIndication: "Unavailable",
      isDemoData: true,
      createdAt: "2026-09-03",
      facialStatus: "failed",
      result: undefined,
    },
  },
};

const stateLabels: Record<PreviewState, { title: string; description: string }> = {
  processing: {
    title: "Processing",
    description: "Text and facial streams in progress with animated spinners.",
  },
  "partial-ready": {
    title: "Partial-ready (No facial AI)",
    description: "Mesh captured, text complete, facial labeled 'provider not connected'.",
  },
  "fully-ready": {
    title: "Fully-ready (Simulated)",
    description: "Complete text and simulated facial expression analysis results.",
  },
  "safety-attention": {
    title: "Safety attention required",
    description: "Crisis/safety signs flagged; halts false reassurance.",
  },
  failure: {
    title: "Failure state",
    description: "Handles provider or service errors gracefully.",
  },
};

const emotionColorMap: Record<string, string> = {
  calm: "hsl(var(--calm))",
  joy: "hsl(var(--happy))",
  hope: "hsl(var(--happy))",
  neutral: "hsl(var(--neutral))",
  sadness: "hsl(var(--sad))",
  anxiety: "hsl(var(--anxious))",
  anger: "hsl(var(--angry))",
};

const recommendationLabels: Record<string, string> = {
  paced_breathing: "Paced breathing",
  grounding: "Grounding exercise",
  behavioral_activation: "One supportive action",
  thought_reframing: "Gentle thought reframing",
  support_connection: "Connect with support",
};

function CheckStateIcon({ state }: { state: string }) {
  if (state === "complete") return <Check className="h-4 w-4 text-emerald-600" />;
  if (state === "running") return <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />;
  if (state === "attention_required" || state === "failed") return <div className="h-2 w-2 rounded-full bg-amber-500" />;
  if (state === "partial") return <div className="h-2 w-2 rounded-full bg-primary/50" />;
  return <div className="h-2 w-2 rounded-full bg-muted-foreground/25" />;
}

function MiniBar({ value, color, delay = 0 }: { value: number; color: string; delay?: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "hsl(var(--secondary))" }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.round(value * 100)}%`,
          background: color,
          opacity: 0.82,
          animation: `echo-bar-grow 550ms cubic-bezier(0.23,1,0.32,1) ${delay}ms both`,
        }}
      />
    </div>
  );
}

export function JournalAnalysisPreviewView() {
  const [selectedState, setSelectedState] = useState<PreviewState>("fully-ready");
  const current = mockAnalyses[selectedState];
  const checks = analysisChecksFor(current.aggregateStatus, current.facialStatus, current.progressPercent);
  const result = current.analysis.result;
  const facialStatus = current.facialStatus;
  const facialIsReady = facialStatus === "completed";

  const triggerLiveModal = () => {
    window.dispatchEvent(
      new CustomEvent("echo:analysis-submitted", {
        detail: {
          journalId: "00000000-0000-4000-8000-000000000001",
          analysisJobId: "00000000-0000-4000-8000-000000000002",
          status: current.aggregateStatus === "safety_action_required" ? "safety_action_required" : "queued",
          facialStatus: current.facialStatus,
        },
      }),
    );
  };

  return (
    <>
      <style>{`
        @keyframes echo-bar-grow {
          from { transform: scaleX(0); transform-origin: left; }
          to   { transform: scaleX(1); transform-origin: left; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="echo-bar-grow"] { animation: none !important; }
        }
      `}</style>

      <div className="mx-auto max-w-[1280px] space-y-3 pb-6">
        {/* ── Back link ── */}
        <Link
          href="/journal/new"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary outline-none transition-transform duration-150 ease-out focus-visible:ring-4 focus-visible:ring-primary/20 active:scale-[.97]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to journal
        </Link>

        {/* ══ ROW 1: Hero header + Five checks status ══════════════════════ */}
        <div className="grid grid-cols-12 gap-3">
          {/* Hero – dark card */}
          <header
            className="col-span-12 overflow-hidden rounded-[1.75rem] p-5 lg:col-span-5"
            style={{
              background: "linear-gradient(135deg, #1a3320 0%, #2d4a2a 55%, #3a5c35 100%)",
              boxShadow: "0 20px 48px rgba(12,30,18,.28)",
            }}
            aria-label="Journal analysis preview header"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/15 text-white">
                  <Leaf className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-white/60">Journal analysis preview</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
                <FlaskConical className="h-3 w-3" aria-hidden="true" />
                Simulated data
              </span>
            </div>
            <h1 className="mt-4 font-[family-name:var(--font-echo-display)] text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Your journal insight
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Development workbench for post-submission modal states, five-check progress, and the full analysis screen.
            </p>
            <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[.06] p-3 text-xs leading-5 text-white/50">
              <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden="true" />
              <p>This preview does not read or analyze a journal. Values are fixed examples for reviewing the interface only.</p>
            </div>
          </header>

          {/* Five checks status */}
          <div
            className="col-span-12 rounded-[1.75rem] border border-primary/10 bg-card/90 p-5 lg:col-span-7"
            style={{ backdropFilter: "blur(10px)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Five analysis checks status</h2>
              <span className="text-xs font-semibold text-primary">{current.progressPercent}% overall</span>
            </div>
            <ul className="mt-3 grid grid-cols-5 gap-2">
              {checks.map((chk) => (
                <li
                  key={chk.id}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/60 bg-secondary/30 p-3 text-center"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-card text-foreground">
                    {chk.id === "safety_crisis" && <ShieldCheck className="h-4 w-4" />}
                    {chk.id === "emotion" && <Brain className="h-4 w-4" />}
                    {chk.id === "distress" && <Activity className="h-4 w-4" />}
                    {chk.id === "phq8" && <ClipboardList className="h-4 w-4" />}
                    {chk.id === "facial" && <ScanFace className="h-4 w-4" />}
                  </span>
                  <div className="flex items-center gap-1"><CheckStateIcon state={chk.state} /></div>
                  <p className="text-[10px] font-semibold capitalize text-foreground leading-tight">
                    {chk.id === "safety_crisis" ? "safety crisis" : chk.id}:
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{chk.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ══ ROW 2: Controls + ECHO perspective ══════════════════════════ */}
        <div className="grid grid-cols-12 gap-3">
          {/* State controls */}
          <section
            className="col-span-12 rounded-[1.75rem] border border-primary/15 bg-card/90 p-4 lg:col-span-5"
            aria-labelledby="preview-controls-heading"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="preview-controls-heading" className="text-xs font-bold uppercase tracking-[.14em] text-primary">
                  Analysis state controls
                </h2>
                <p className="text-[11px] text-muted-foreground">Select a state to inspect UI representations:</p>
              </div>
              <button
                type="button"
                onClick={triggerLiveModal}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-transform duration-150 ease-out focus-visible:ring-4 focus-visible:ring-primary/20 active:scale-[.97]"
              >
                <Play className="h-3 w-3" aria-hidden="true" /> Launch live modal
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Analysis preview states">
              {(Object.keys(mockAnalyses) as PreviewState[]).map((state) => {
                const isSelected = selectedState === state;
                return (
                  <button
                    key={state}
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedState(state)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-[background-color,transform,color] duration-150 ease-out active:scale-[.97] ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border/70 bg-secondary/40 text-foreground hover:bg-secondary"
                    }`}
                  >
                    {stateLabels[state].title}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              {stateLabels[selectedState].description}
            </p>
          </section>

          {/* ECHO perspective */}
          <div
            className="col-span-12 overflow-hidden rounded-[1.75rem] border border-primary/10 p-5 lg:col-span-7"
            style={{
              background: "linear-gradient(145deg,rgba(255,253,247,.97),rgba(230,239,224,.85))",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_4px_12px_rgba(16,42,36,.18)]">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Private journal analysis</p>
                  <h2 className="font-[family-name:var(--font-echo-display)] text-2xl font-semibold text-foreground">
                    ECHO perspective
                  </h2>
                  <p className="text-[11px] text-muted-foreground">Reflective signals to help you notice patterns—not clinical interpretation.</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-amber-700/15 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-amber-900">
                Simulated data
              </span>
            </div>
            <blockquote className="mt-3 flex gap-2.5 rounded-2xl border border-primary/10 bg-card/70 p-3.5">
              <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-sm leading-6 text-muted-foreground">{current.analysis.perspective}</p>
            </blockquote>
          </div>
        </div>

        {/* ══ ROWS 3-5: Bento analysis grid ═══════════════════════════════ */}
        {selectedState === "safety-attention" ? (
          <div className="overflow-hidden rounded-[1.75rem] border border-amber-700/20 bg-amber-50/50 p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-600 text-white">
                <HeartHandshake className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-amber-900">Immediate Support Mode</p>
                <h3 className="font-[family-name:var(--font-echo-display)] text-xl font-semibold text-amber-950">Support options are ready</h3>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-amber-900/80">
              When safety triggers are identified, ECHO halts standard text score outputs to avoid offering false reassurance. Instead, verified immediate crisis resources and trusted contact handoffs are surfaced directly.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/crisis-help" className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-xs font-semibold text-white transition-transform active:scale-[.97]">
                Open verified support options <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : selectedState === "failure" ? (
          <div className="rounded-[1.75rem] border border-border/80 bg-card p-6 text-center">
            <h3 className="text-lg font-semibold text-foreground">Analysis unavailable</h3>
            <p className="mt-2 text-sm text-muted-foreground">Your reflection was saved safely, but an issue prevented the AI service from analyzing it.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3" aria-label="Analysis results">
              {/* 1. Emotion analysis */}
              <article
                className="col-span-3 rounded-[1.5rem] border border-primary/10 bg-card/85 p-4 md:col-span-1"
                style={{ backdropFilter: "blur(8px)" }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">1</span>
                  <h3 className="text-xs font-semibold text-foreground">Emotion analysis</h3>
                  {result && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-700/20 bg-emerald-50/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <Check className="h-2.5 w-2.5" /> Ready
                    </span>
                  )}
                </div>
                {result ? (
                  <>
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Emotion distribution</p>
                    <div className="space-y-2">
                      {result.emotionDistribution.map((em, i) => (
                        <div key={em.emotion}>
                          <div className="mb-1 flex justify-between text-[11px]">
                            <span className="capitalize text-foreground/80">{em.emotion}</span>
                            <span className="font-semibold tabular-nums text-muted-foreground">{Math.round(em.value * 100)}%</span>
                          </div>
                          <MiniBar
                            value={em.value}
                            color={emotionColorMap[em.emotion.toLowerCase()] ?? "hsl(var(--primary))"}
                            delay={i * 40}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="animate-pulse text-xs text-muted-foreground">Processing…</p>
                )}
              </article>

              {/* 2. Journal distress */}
              <article
                className="col-span-3 rounded-[1.5rem] border border-[hsl(var(--risk-low)/0.35)] bg-[hsl(var(--risk-low-soft))] p-4 md:col-span-1"
                style={{ backdropFilter: "blur(8px)" }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/40 text-[11px] font-bold text-foreground/80">2</span>
                  <h3 className="text-xs font-semibold text-foreground">Journal distress</h3>
                </div>
                {result ? (
                  <>
                    <p className="font-[family-name:var(--font-echo-display)] text-5xl font-semibold capitalize text-[hsl(var(--risk-low-foreground))]">
                      {result.distressBand}
                    </p>
                    <p className="mt-2 text-[11px] text-foreground/60">
                      Estimated with {Math.round(result.distressConfidence * 100)}% model confidence.
                    </p>
                  </>
                ) : (
                  <p className="animate-pulse text-xs text-muted-foreground">Processing…</p>
                )}
              </article>

              {/* 3. PHQ-8 */}
              <article
                className="col-span-3 rounded-[1.5rem] border border-primary/10 bg-card/85 p-4 md:col-span-1"
                style={{ backdropFilter: "blur(8px)" }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">3</span>
                  <h3 className="text-xs font-semibold text-foreground">PHQ-8 symptom estimate</h3>
                </div>
                {result ? (
                  <>
                    <p className="font-[family-name:var(--font-echo-display)] text-4xl font-semibold tabular-nums text-foreground">
                      {result.depressiveSymptomRange.lower}–{result.depressiveSymptomRange.upper}
                      <span className="ml-1 font-sans text-base font-normal text-muted-foreground">/ 24</span>
                    </p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "hsl(var(--secondary))" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round(((result.depressiveSymptomRange.upper) / 24) * 100)}%`,
                          background: "hsl(var(--risk-low))",
                          opacity: 0.75,
                          animation: "echo-bar-grow 700ms cubic-bezier(0.23,1,0.32,1) 160ms both",
                        }}
                      />
                    </div>
                    <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
                      AI-estimated depressive-symptom range: {result.depressiveSymptomRange.lower}–{result.depressiveSymptomRange.upper} out of 24.
                    </p>
                    <p className="text-[10px] text-muted-foreground">Not a diagnosis or completed PHQ-8 assessment.</p>
                  </>
                ) : (
                  <p className="animate-pulse text-xs text-muted-foreground">Processing…</p>
                )}
              </article>

              {/* 4. Safety check */}
              <article
                className="col-span-3 rounded-[1.5rem] border border-emerald-700/20 bg-emerald-50/70 p-4 md:col-span-1"
                style={{ backdropFilter: "blur(8px)" }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-[11px] font-bold text-emerald-700">4</span>
                  <h3 className="text-xs font-semibold text-foreground">Safety and crisis-sign check</h3>
                </div>
                <p className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                  Safety check complete
                </p>
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  This check cannot rule out every support need. Reach out whenever you feel unsafe.
                </p>
              </article>

              {/* 5. Facial expression */}
              <article
                className="col-span-3 rounded-[1.5rem] border border-primary/10 bg-card/85 p-4 md:col-span-1"
                style={{ backdropFilter: "blur(8px)" }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold ${facialIsReady ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"}`}>5</span>
                  <h3 className="text-xs font-semibold text-foreground">Facial expression analysis</h3>
                </div>
                {facialIsReady && result?.facialExpressionAnalysis ? (
                  <>
                    <p className="text-base font-semibold text-foreground">{result.facialExpressionAnalysis.detectedEmotion} signal ready</p>
                    <div className="mt-2 space-y-1.5">
                      {result.facialExpressionAnalysis.emotionDistribution.slice(0, 3).map((fe, i) => (
                        <div key={fe.emotion}>
                          <div className="mb-0.5 flex justify-between text-[11px]">
                            <span className="capitalize text-foreground/80">{fe.emotion}</span>
                            <span className="font-semibold text-muted-foreground">{Math.round(fe.value * 100)}%</span>
                          </div>
                          <MiniBar
                            value={fe.value}
                            color={emotionColorMap[fe.emotion.toLowerCase()] ?? "hsl(var(--primary))"}
                            delay={200 + i * 50}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground/80">
                      {facialStatus === "captured_pending_provider"
                        ? "Mesh captured — analysis provider not connected"
                        : facialStatus === "not_requested"
                          ? "Not requested for this reflection"
                          : facialStatus === "analyzing"
                            ? "Analyzing facial mesh…"
                            : "Facial analysis not available yet"}
                    </p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">No facial photo or video is stored with this journal.</p>
                  </>
                )}
              </article>

              {/* 6. Gentle next steps */}
              <article
                className="col-span-3 rounded-[1.5rem] border border-primary/10 bg-card/85 p-4 md:col-span-1"
                style={{ backdropFilter: "blur(8px)" }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">6</span>
                  <h3 className="text-xs font-semibold text-foreground">Gentle next steps</h3>
                </div>
                {result ? (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {result.recommendationFeatures.map((feature) => (
                        <span
                          key={feature}
                          className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/[.07] px-3 py-1.5 text-xs font-semibold text-primary"
                        >
                          {feature === "paced_breathing" && <Wind className="h-3 w-3" />}
                          {feature === "grounding" && <Zap className="h-3 w-3" />}
                          {recommendationLabels[feature] ?? feature.replaceAll("_", " ")}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] leading-5 text-muted-foreground">
                      These private AI-generated estimates are for reflection only. They do not diagnose, treat, or replace professional care.
                    </p>
                  </>
                ) : (
                  <p className="animate-pulse text-xs text-muted-foreground">Processing…</p>
                )}
              </article>
            </div>

            {/* ── Footer row ── */}
            <div className="grid grid-cols-2 gap-3">
              <article className="rounded-[1.5rem] border border-border/70 bg-card/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-primary">Gentle next step</p>
                <h2 className="mt-1.5 text-sm font-semibold text-foreground">Try one minute of paced breathing</h2>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  Let your exhale run slightly longer than your inhale, without forcing the pace.
                </p>
              </article>
              <article className="rounded-[1.5rem] border border-border/70 bg-card/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-primary">When integration is ready</p>
                <h2 className="mt-1.5 text-sm font-semibold text-foreground">Your saved result appears here</h2>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  The same layout will use the completed, consented analysis returned for that journal entry.
                </p>
              </article>
            </div>
          </>
        )}
      </div>
    </>
  );
}
