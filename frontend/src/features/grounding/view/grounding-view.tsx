"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  HandHeart,
  Leaf,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wind,
} from "lucide-react";
import { useGroundingViewModel, type GroundingTechnique } from "../view-model/use-grounding-view-model";

const groundingPractices = [
  {
    id: "box-breathing" as GroundingTechnique,
    title: "Box breathing",
    shortLabel: "Breathe",
    description: "Settle into an even rhythm: in, hold, out, rest.",
    idleCue: "Find a comfortable position and let your shoulders drop.",
    activeCue: "Follow the circle. Nothing needs to be forced.",
    icon: Wind,
  },
  {
    id: "5-4-3-2-1" as GroundingTechnique,
    title: "5-4-3-2-1 senses",
    shortLabel: "Notice",
    description: "Return to the present through what your senses can notice.",
    idleCue: "Begin with five things you can see around you.",
    activeCue: "Notice slowly. There is no need to find perfect answers.",
    icon: HandHeart,
  },
  {
    id: "window-reset" as GroundingTechnique,
    title: "Window reset",
    shortLabel: "Observe",
    description: "Rest your attention on light, color, shape, and movement.",
    idleCue: "Choose one calm point beyond the room to look toward.",
    activeCue: "Let your eyes wander gently across the scene.",
    icon: Leaf,
  },
] as const;

const durations = [2, 5, 10] as const;
const paces = [
  { value: "gentle" as const, label: "Gentle", detail: "Long, easy rhythm" },
  { value: "slower" as const, label: "Slower", detail: "More room between cues" },
  { value: "steady" as const, label: "Steady", detail: "A little more momentum" },
];

const cycleSeconds = { gentle: 10, slower: 8, steady: 6 } as const;

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function GroundingView() {
  const vm = useGroundingViewModel();
  const selected = groundingPractices.find((practice) => practice.id === vm.technique) ?? groundingPractices[0];
  const SelectedIcon = selected.icon;
  const elapsedPercent = vm.totalSeconds
    ? Math.min(100, Math.max(0, ((vm.totalSeconds - vm.remainingSeconds) / vm.totalSeconds) * 100))
    : 0;
  const hasEnded = vm.remainingSeconds === 0;
  const isComplete = vm.remainingSeconds === 0 && !vm.isSaving;
  const sessionStyle = { "--grounding-cycle": `${cycleSeconds[vm.pace]}s` } as CSSProperties;

  return (
    <div className="pb-6">
      <header className="flex flex-col gap-5 border-b border-border/70 pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-secondary/55 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Grounding studio
          </div>
          <h1 className="max-w-3xl text-4xl font-medium leading-[0.96] tracking-[-0.055em] text-foreground [font-family:var(--font-echo-display)] sm:text-5xl lg:text-[3.65rem]">
            Take one quiet minute.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            Pick what feels manageable. ECHO will hold the time so you can stay with the moment.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-3 shadow-subtle">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold text-foreground">Private by default</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Saved only when you complete a practice.</p>
          </div>
        </div>
      </header>

      <section className="py-6" aria-labelledby="practice-heading">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-primary">Choose a practice</p>
            <h2 id="practice-heading" className="mt-1 text-lg font-semibold tracking-[-0.025em] text-foreground">
              What would help right now?
            </h2>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">You can switch before starting.</p>
        </div>

        <div className="grid gap-2.5 md:grid-cols-3">
          {groundingPractices.map((practice, index) => {
            const Icon = practice.icon;
            const active = vm.technique === practice.id;
            return (
              <button
                key={practice.id}
                type="button"
                onClick={() => vm.selectTechnique(practice.id)}
                aria-pressed={active}
                disabled={vm.isRunning}
                className={`group flex min-h-28 items-start gap-3 rounded-[1.4rem] border p-4 text-left outline-none transition-[transform,background-color,border-color,box-shadow] duration-150 active:scale-[0.98] motion-reduce:transform-none focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60 ${
                  active
                    ? "border-[#173f31] bg-[#173f31] text-[#fffaf0] shadow-[0_14px_34px_rgba(18,51,40,0.18)]"
                    : "border-border/70 bg-card/80 text-foreground hover:border-primary/25 hover:bg-card"
                }`}
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${active ? "bg-white/10 text-[#dce8d6]" : "bg-secondary text-primary"}`}>
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${active ? "text-[#b9d1bd]" : "text-primary"}`}>
                    0{index + 1} · {practice.shortLabel}
                  </span>
                  <strong className="mt-1 block text-[15px] leading-5">{practice.title}</strong>
                  <span className={`mt-1 block text-xs leading-5 ${active ? "text-white/65" : "text-muted-foreground"}`}>
                    {practice.description}
                  </span>
                </span>
                <CheckCircle2 className={`mt-1 h-4 w-4 shrink-0 transition-opacity duration-150 ${active ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 min-[1180px]:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.62fr)]">
        <section
          className="relative isolate min-h-[34rem] overflow-hidden rounded-[2.25rem] bg-[#123328] p-5 text-[#fffaf0] shadow-[0_30px_80px_rgba(18,51,40,0.22)] sm:p-7 lg:min-h-[38rem] lg:p-9"
          aria-labelledby="session-title"
          style={sessionStyle}
        >
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_42%,rgba(158,197,166,0.19),transparent_17rem),radial-gradient(circle_at_100%_0%,rgba(255,241,205,0.09),transparent_24rem)]" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-40 -left-36 -z-10 h-96 w-96 rounded-full border border-white/[0.05]" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-28 -left-24 -z-10 h-72 w-72 rounded-full border border-white/[0.06]" aria-hidden="true" />

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.08] text-[#c7ddca]">
                <SelectedIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9fc1a6]">Current practice</p>
                <h2 id="session-title" className="mt-1 text-lg font-semibold tracking-[-0.02em]">{selected.title}</h2>
              </div>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-white/75">
              {vm.durationMinutes} min
            </span>
          </div>

          <div className="flex min-h-[27rem] flex-col items-center justify-center py-8 text-center lg:min-h-[30rem]">
            <div className="relative grid h-48 w-48 place-items-center sm:h-56 sm:w-56">
              <div className="absolute inset-0 rounded-full border border-[#b9d1bd]/15" aria-hidden="true" />
              <div className="absolute inset-5 rounded-full border border-[#b9d1bd]/20" aria-hidden="true" />
              <div data-running={vm.isRunning} className="grounding-session-orb absolute inset-9 rounded-full bg-[radial-gradient(circle_at_38%_30%,#eff7e9_0%,#b9d8bd_38%,#6f9f7e_100%)] shadow-[0_0_70px_rgba(169,209,177,0.25),inset_0_1px_18px_rgba(255,255,255,0.55)]" aria-hidden="true" />
              <span className="relative z-10 text-xs font-semibold tracking-wide text-[#173f31]">
                {hasEnded ? (vm.isSaving ? "Saving" : "Complete") : vm.isRunning ? "Stay with it" : "Ready"}
              </span>
            </div>

            <p className="mt-7 text-[clamp(3.6rem,8vw,5.4rem)] font-medium leading-none tracking-[-0.07em] [font-family:var(--font-echo-display)]" aria-label={`${formatTime(vm.remainingSeconds)} remaining`}>
              {formatTime(vm.remainingSeconds)}
            </p>
            <p className="mt-3 min-h-6 max-w-md text-sm leading-6 text-white/65" aria-live="polite">
              {hasEnded
                ? vm.isSaving
                  ? "Finishing your practice…"
                  : "You made a little room. Take your time before moving on."
                : vm.isRunning
                  ? selected.activeCue
                  : selected.idleCue}
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              <button type="button" onClick={vm.toggleRunning} disabled={vm.remainingSeconds === 0 || vm.isSaving} className="inline-flex h-12 min-w-40 items-center justify-center gap-2 rounded-full bg-[#fffaf0] px-6 text-sm font-bold text-[#173f31] shadow-[0_10px_24px_rgba(0,0,0,0.18)] outline-none transition-[transform,background-color,box-shadow] duration-150 hover:bg-white active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-4 focus-visible:ring-white/25 disabled:cursor-not-allowed disabled:opacity-45">
                {vm.isRunning ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />}
                {vm.isRunning ? "Pause" : vm.remainingSeconds < vm.totalSeconds ? "Continue" : "Begin practice"}
              </button>
              <button type="button" onClick={vm.reset} className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 text-sm font-semibold text-white/80 outline-none transition-[transform,background-color,border-color] duration-150 hover:border-white/25 hover:bg-white/10 active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-4 focus-visible:ring-white/20">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reset
              </button>
            </div>

            {vm.status ? (
              <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-[#dce8d6]" role="status">
                {isComplete ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : null}
                {vm.status}
              </p>
            ) : null}
          </div>

          <div className="absolute inset-x-5 bottom-5 sm:inset-x-7 sm:bottom-7 lg:inset-x-9 lg:bottom-8">
            <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.13em] text-white/45">
              <span>{vm.isRunning ? "Session in progress" : vm.isSaving ? "Finishing session" : isComplete ? "Session complete" : "Your session"}</span>
              <span>{Math.round(elapsedPercent)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(elapsedPercent)}>
              <div className="h-full rounded-full bg-[#b9d8bd] transition-[width] duration-200 ease-out" style={{ width: `${elapsedPercent}%` }} />
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-[0_18px_48px_rgba(20,45,40,0.07)] sm:p-6" aria-labelledby="settings-heading">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">Session settings</p>
                <h2 id="settings-heading" className="mt-1 text-xl font-semibold tracking-[-0.03em] text-foreground">Make it yours</h2>
              </div>
              <Clock3 className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
            </div>

            <fieldset className="mt-6" disabled={vm.isRunning}>
              <legend className="text-xs font-semibold text-foreground">How much time?</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {durations.map((duration) => {
                  const active = vm.durationMinutes === duration;
                  return (
                    <button key={duration} type="button" onClick={() => vm.selectDuration(duration)} aria-pressed={active} className={`h-11 rounded-xl border text-sm font-semibold outline-none transition-[transform,background-color,border-color,color] duration-150 active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-45 ${active ? "border-primary bg-primary text-primary-foreground" : "border-border/70 bg-background text-muted-foreground hover:border-primary/30"}`}>
                      {duration} min
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="mt-6" disabled={vm.isRunning}>
              <legend className="text-xs font-semibold text-foreground">Choose a pace</legend>
              <div className="mt-2 space-y-2">
                {paces.map((pace) => {
                  const active = vm.pace === pace.value;
                  return (
                    <button key={pace.value} type="button" onClick={() => vm.selectPace(pace.value)} aria-pressed={active} className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left outline-none transition-[transform,background-color,border-color] duration-150 active:scale-[0.98] motion-reduce:transform-none focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-45 ${active ? "border-primary/35 bg-secondary/70" : "border-border/70 bg-background hover:border-primary/25"}`}>
                      <span>
                        <span className="block text-sm font-semibold text-foreground">{pace.label}</span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{pace.detail}</span>
                      </span>
                      <span className={`h-3.5 w-3.5 rounded-full border ${active ? "border-primary bg-primary shadow-[inset_0_0_0_3px_hsl(var(--secondary))]" : "border-border"}`} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <p className="mt-5 text-[11px] leading-5 text-muted-foreground">Settings pause while the timer runs, so the rhythm stays consistent.</p>
          </section>

          <section className="rounded-[1.6rem] border border-primary/15 bg-secondary/55 p-5" aria-label="Practice history">
            <div className="flex items-center gap-4">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-card text-primary shadow-subtle">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-3xl font-semibold leading-none tracking-[-0.05em] text-foreground">{vm.completedSessions ?? "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">private practices completed</p>
              </div>
            </div>
          </section>

          <Link href="/crisis" className="group flex items-center justify-between gap-4 rounded-[1.4rem] border border-danger/20 bg-crisis-soft/70 p-4 outline-none transition-[transform,background-color,border-color] duration-150 hover:border-danger/30 hover:bg-crisis-soft active:scale-[0.985] motion-reduce:transform-none focus-visible:ring-4 focus-visible:ring-danger/15">
            <span>
              <span className="block text-xs font-semibold text-foreground">Need more support right now?</span>
              <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">Open immediate support options.</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
