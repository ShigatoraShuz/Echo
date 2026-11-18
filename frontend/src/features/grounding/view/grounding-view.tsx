"use client";
import { markSupportVisitArrived } from "@/features/journal/model/support-journey";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Clock3, Heart, Leaf,
  Pause, Play, RotateCcw, ShieldCheck, Waves,
} from "lucide-react";
import {
  groundingPractices, type GroundingPractice,
} from "../model/grounding-practices";
import { useGroundingViewModel } from "../view-model/use-grounding-view-model";

const artIcons = { leaves: Leaf, water: Waves } as const;
const artClasses = {
  leaves: "bg-[radial-gradient(circle_at_74%_20%,#e8efd7_0%,transparent_36%),linear-gradient(135deg,#476e58,#a8c6a4_58%,#e7e4be)]",
  water: "bg-[radial-gradient(ellipse_at_50%_75%,#afd4cf_0%,transparent_48%),linear-gradient(160deg,#285975,#5c9bb0_55%,#c4ded1)]",
} as const;
const paceOptions = [
  { value: "gentle", label: "Gentle" }, { value: "slower", label: "Slower" }, { value: "steady", label: "Steady" },
] as const;
const durationOptions = [2, 3, 5, 10] as const;

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function PracticeArt({ art }: { art: GroundingPractice["art"] }) {
  const Icon = artIcons[art];
  return (
    <div className={`relative isolate overflow-hidden h-20 w-full rounded-t-[1.15rem] sm:h-28 ${artClasses[art]}`} aria-hidden="true">
      <div className="absolute -bottom-12 -left-10 h-28 w-48 rotate-[-16deg] rounded-[50%] border-[12px] border-white/15" />
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-xl" />
      <Icon className="absolute bottom-4 right-5 h-12 w-12 text-white/75 drop-shadow-sm" strokeWidth={1.2} />
    </div>
  );
}

function PracticeCard({ practice, onStart }: { practice: GroundingPractice; onStart: (practice: GroundingPractice) => void }) {
  return (
    <article className="echo-workspace-tile flex h-full flex-col overflow-hidden rounded-[1.2rem] border border-border/70 bg-card/95 shadow-sm">
      <PracticeArt art={practice.art} />
      <div className="flex flex-1 flex-col items-start p-3.5">
        <h3 className="line-clamp-2 min-h-8 text-sm font-semibold leading-4 text-foreground">{practice.title}</h3>
        <p className="mt-1 line-clamp-2 min-h-9 text-xs leading-[1.15rem] text-muted-foreground">{practice.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock3 size={12} />{practice.minutes} min</span>
          <span>{practice.category}</span>
        </div>
        <button type="button" onClick={() => onStart(practice)} aria-label={`Start ${practice.title}`} className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Play size={13} aria-hidden="true" />Start
        </button>
      </div>
    </article>
  );
}

function GroundingSession({
  practice, vm, onClose,
}: {
  practice: GroundingPractice;
  vm: ReturnType<typeof useGroundingViewModel>;
  onClose: () => void;
}) {
  const [senseStep, setSenseStep] = useState(0);
  const elapsed = vm.totalSeconds - vm.remainingSeconds;
  const cycleSeconds = vm.pace === "slower" ? 12 : vm.pace === "steady" ? 7 : 10;
  const boxPhase = Math.floor(elapsed / cycleSeconds) % 4;
  const breathFraction = (elapsed % cycleSeconds) / cycleSeconds;
  const orbScale = practice.id === "box-breathing"
    ? boxPhase === 0 ? 0.88 + breathFraction * 0.24 : boxPhase === 1 ? 1.12 : boxPhase === 2 ? 1.12 - breathFraction * 0.24 : 0.88
    : 1;
  const cueIndex = practice.id === "box-breathing" ? boxPhase : senseStep;
  const progress = Math.round((elapsed / vm.totalSeconds) * 100);
  return (
    <div className="echo-workspace-enter grid min-h-0 gap-3 lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]">
      <section className="flex min-h-[31rem] flex-col overflow-hidden rounded-[1.5rem] bg-[#14382d] p-4 text-[#fffaf0] shadow-xl lg:min-h-0 lg:p-6" aria-labelledby="session-heading">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8d8be]">Your practice</p>
            <h2 id="session-heading" className="mt-1 text-xl [font-family:var(--font-echo-display)]">{practice.title}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={vm.isSaving} className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/85 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <ArrowLeft size={13} /> Browse
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-5 text-center">
          <div className="relative grid h-32 w-32 place-items-center rounded-full border border-white/15 sm:h-40 sm:w-40">
            <div className="absolute inset-3 rounded-full border border-white/15" />
            <div className="grounding-session-orb absolute inset-7 rounded-full bg-[radial-gradient(circle_at_35%_28%,#ecf5e6,#a8d1b1_55%,#649877)] shadow-[0_0_48px_#94c5a05c] transition-transform duration-700" style={{ transform: `scale(${orbScale})` }} aria-hidden="true" />
            <span className="relative z-10 text-xs font-bold text-[#163a2e]">{vm.remainingSeconds === 0 ? "Done" : vm.isRunning ? "Here" : "Paused"}</span>
          </div>
          <p className="mt-4 text-5xl tabular-nums [font-family:var(--font-echo-display)]" aria-label={`${formatTime(vm.remainingSeconds)} remaining`}>{formatTime(vm.remainingSeconds)}</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-white/75" aria-live="polite">
            {vm.remainingSeconds === 0 ? "A little space for yourself. Take your time." : practice.cues[cueIndex]}
          </p>
          {practice.id === "sensory-5-4-3-2-1" && vm.remainingSeconds > 0 && (
            <button type="button" onClick={() => setSenseStep((step) => Math.min(4, step + 1))} disabled={senseStep === 4} className="mt-3 rounded-full border border-white/25 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-50">
              {senseStep === 4 ? "Final sense" : `Next sense · ${senseStep + 1} of 5`}
            </button>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={vm.toggleRunning} disabled={vm.remainingSeconds === 0 || vm.isSaving} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#fffaf0] px-5 text-sm font-semibold text-[#173f31] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-45">
              {vm.isRunning ? <Pause size={15} /> : <Play size={15} />}{vm.isRunning ? "Pause" : "Continue"}
            </button>
            <button type="button" onClick={() => { setSenseStep(0); vm.reset(); }} disabled={vm.isSaving} className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 px-4 text-sm hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <RotateCcw size={14} />Reset
            </button>
          </div>
          {vm.status && <p role="status" className="mt-4 text-xs text-[#d5e9d7]">{vm.status}</p>}
          {vm.saveError && <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={vm.retrySave} disabled={vm.isSaving} className="min-h-11 rounded-full bg-[#fffaf0] px-4 text-sm font-semibold text-[#173f31] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50">Retry saving</button>
            <button type="button" onClick={() => { vm.reloadHistory(); onClose(); }} className="min-h-11 rounded-full border border-white/30 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Check saved practices</button>
          </div>}
        </div>
        <div className="h-1.5 rounded-full bg-white/15" role="progressbar" aria-label="Practice progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="h-full rounded-full bg-[#a9d4af] transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
      </section>
      <aside className="echo-panel-scroll min-h-0 space-y-3 overflow-y-auto rounded-[1.5rem] border border-border/70 bg-card/90 p-4 lg:p-5" aria-label="Practice settings">
        <h3 className="text-base font-semibold text-foreground">Make it yours</h3>
        <p className="text-xs leading-5 text-muted-foreground">The timer continues while this tab is in the background. Pause before switching apps. Adjusting duration restarts the timer.</p>
        <fieldset disabled={vm.isRunning || vm.isSaving}>
          <legend className="mb-2 text-xs font-semibold text-foreground">Duration</legend>
          <div className="grid grid-cols-2 gap-2">
            {durationOptions.map((minutes) => <button key={minutes} type="button" onClick={() => vm.selectDuration(minutes)} aria-pressed={vm.durationMinutes === minutes} className={`rounded-xl border px-2 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${vm.durationMinutes === minutes ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}`}>{minutes} min</button>)}
          </div>
        </fieldset>
        <fieldset disabled={vm.isRunning || vm.isSaving}>
          <legend className="mb-2 text-xs font-semibold text-foreground">Pace</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {paceOptions.map((pace) => <button key={pace.value} type="button" onClick={() => vm.selectPace(pace.value)} aria-pressed={vm.pace === pace.value} className={`rounded-xl border px-1 py-2 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${vm.pace === pace.value ? "border-primary bg-secondary text-primary" : "border-border bg-background text-muted-foreground"}`}>{pace.label}</button>)}
          </div>
        </fieldset>
        <Link href="/crisis" className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline underline-offset-2">Need more support? <ArrowRight size={13} /></Link>
      </aside>
    </div>
  );
}

export function GroundingView() {
  useEffect(() => { markSupportVisitArrived("grounding"); }, []);
  const vm = useGroundingViewModel();
  const [activePractice, setActivePractice] = useState<GroundingPractice | null>(null);
  const [showProgressInfo, setShowProgressInfo] = useState(false);
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return { label: date.toLocaleDateString("en-US", { weekday: "short" }), key: date.toDateString() };
  });
  const practicedDays = new Set((vm.history ?? []).flatMap((item) => {
    const date = item.startedAt ?? item.completedAt;
    return date ? [new Date(date).toDateString()] : [];
  }));
  const weeklyCount = weekdays.filter((day) => practicedDays.has(day.key)).length;

  function startPractice(practice: GroundingPractice, minutes = practice.minutes) {
    setActivePractice(practice);
    vm.startPractice(practice.id, minutes);
  }

  return (
    <div className="grounding-workspace flex min-h-0 flex-col gap-3 pb-3 lg:h-full lg:pb-0">
      <header className="echo-workspace-enter relative isolate min-h-40 overflow-hidden rounded-[1.5rem] border border-border/60 bg-[var(--landing-cream)] bg-center px-5 py-4 sm:min-h-32 sm:px-6 lg:shrink-0" style={{ backgroundImage: "url('/grounding-landscape.svg')", backgroundSize: "cover" }}>
        <div className="pointer-events-none absolute inset-0 sm:hidden" style={{ background: "linear-gradient(90deg, rgba(252,250,246,.95) 0%, rgba(252,250,246,.88) 50%, rgba(252,250,246,0) 85%)" }} aria-hidden="true" />
        <p className="relative z-10 text-[10px] font-bold uppercase tracking-[0.17em] text-primary">Grounding</p>
        <h1 className="relative z-10 mt-1 max-w-[14rem] text-[clamp(1.9rem,2.8vw,2.5rem)] leading-[0.98] text-foreground [font-family:var(--font-echo-display)] sm:max-w-none">Take a moment. Breathe.</h1>
        <p className="relative z-10 mt-2 max-w-[15rem] text-xs leading-5 text-muted-foreground sm:max-w-[36rem] sm:text-sm">Simple practices to help you feel more present, at your own pace.</p>
      </header>

      {activePractice ? (
        <GroundingSession key={activePractice.id} practice={activePractice} vm={vm} onClose={() => { vm.reset(); setActivePractice(null); }} />
      ) : (
        <div className="grid min-h-0 gap-3 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)]">
          <div className="contents lg:block lg:min-h-0 lg:space-y-3 lg:overflow-y-auto lg:pr-1">

              <section className="echo-workspace-enter order-1 min-w-0 rounded-[1.5rem] border border-border/70 bg-card/80 p-3 shadow-sm sm:p-4 lg:order-none" aria-labelledby="recommended-heading">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div><h2 id="recommended-heading" className="text-base font-semibold text-foreground">A gentle place to begin</h2><p className="text-xs text-muted-foreground">Choose the practice that fits this moment.</p></div>

                </div>
                <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
                  {groundingPractices.map((practice) => <PracticeCard key={practice.id} practice={practice} onStart={startPractice} />)}
                </div>
              </section>
          </div>
          <aside className="contents lg:block lg:min-h-0 lg:space-y-3 lg:overflow-y-auto lg:pr-1" aria-label="Grounding progress and support">
            <section className="echo-workspace-enter order-2 rounded-[1.5rem] border border-border/70 bg-card/90 p-4 shadow-sm lg:order-none" aria-labelledby="wellbeing-heading">
              <div className="flex items-start justify-between gap-2"><div><h2 id="wellbeing-heading" className="text-sm font-semibold text-foreground">Your wellbeing</h2><p className="mt-0.5 text-xs text-muted-foreground">Small steps, this week.</p></div><button type="button" onClick={() => setShowProgressInfo((value) => !value)} aria-label="About weekly progress" aria-expanded={showProgressInfo} className="rounded-full p-1 text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ShieldCheck size={17} /></button></div>
              {showProgressInfo && <p className="mt-2 rounded-lg bg-secondary/50 p-2 text-[11px] leading-4 text-muted-foreground">A day counts as soon as you start a practice and it is saved to your private account. Each day counts once, even with several practices.</p>}
              {vm.historyError ? <div className="mt-4"><p role="alert" className="text-xs text-muted-foreground">{vm.historyError}</p><button type="button" onClick={vm.reloadHistory} className="mt-2 min-h-11 text-xs font-semibold text-primary underline underline-offset-2">Retry loading history</button></div>
                : vm.history === null ? <p role="status" className="mt-4 text-xs text-muted-foreground">Loading your practices…</p>
                  : <><div className="mt-4 flex items-center gap-3"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-full p-1.5 sm:h-20 sm:w-20 sm:p-2" style={{ background: `conic-gradient(#255843 ${weeklyCount / 7 * 360}deg, #e2e9df 0)` }}><span className="grid h-full w-full place-items-center rounded-full bg-card text-primary"><Leaf size={22} /></span></div><div><p className="text-xl font-semibold text-foreground">{weeklyCount} / 7</p><p className="text-xs text-muted-foreground">days practiced</p></div></div><div className="mt-4 grid grid-cols-7 gap-1">{weekdays.map((day) => <div key={day.key} className="text-center" role="img" aria-label={`${day.label}: ${practicedDays.has(day.key) ? "practiced" : "no practice yet"}`}><p className="text-[10px] text-muted-foreground">{day.label}</p><span className={`mx-auto mt-1 block h-3.5 w-3.5 rounded-full ${practicedDays.has(day.key) ? "bg-primary" : "bg-secondary"}`} /></div>)}</div></>}
            </section>
            <section className="echo-workspace-enter order-4 rounded-[1.5rem] border border-border/70 bg-card/90 p-4 shadow-sm lg:order-none" aria-labelledby="suggestion-heading">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">A small step for today</p>
              <div className="mt-2 overflow-hidden rounded-xl"><PracticeArt art="leaves" /></div>
              <h2 id="suggestion-heading" className="mt-3 text-sm font-semibold text-foreground">Take a deep breath</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">A short breathing practice can help you pause and reset.</p>
              <button type="button" onClick={() => startPractice(groundingPractices[0], 2)} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Play size={13} />Start 2-minute exercise</button>
            </section>
            <section className="echo-workspace-enter order-5 flex gap-2 rounded-[1.5rem] border border-border/70 bg-secondary/60 p-4 lg:order-none" aria-label="Remember">
              <Heart size={18} className="shrink-0 text-primary" aria-hidden="true" /><div><h2 className="text-xs font-semibold text-foreground">Remember</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">It is okay to pause. Your feelings are valid, and small steps count.</p><Link href="/crisis" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary underline underline-offset-2">Need immediate support? <ArrowRight size={12} /></Link></div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
