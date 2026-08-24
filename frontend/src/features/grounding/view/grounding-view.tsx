"use client";
import Link from "next/link";
import { CheckCircle2, Clock, HandHeart, Leaf, Pause, Play, RotateCcw, ShieldAlert, Sparkles, Wind } from "lucide-react";
import { useGroundingViewModel, type GroundingTechnique } from "../view-model/use-grounding-view-model";
import { CrisisHelpCard } from "@/shared/components/echo";
import { EchoCard, PageHeader } from "@/shared/components/layout";
import { BreathingCircle } from "@/shared/components/ui";

const groundingCards = [
  {
    id: "5-4-3-2-1" as GroundingTechnique,
    title: "5-4-3-2-1",
    description: "Name things you can see, feel, hear, smell, and taste.",
    icon: HandHeart,
  },
  {
    id: "window-reset" as GroundingTechnique,
    title: "Window reset",
    description: "Look outside and describe colors, shapes, and movement.",
    icon: Leaf,
  },
  {
    id: "box-breathing" as GroundingTechnique,
    title: "Box breathing",
    description: "Inhale, hold, exhale, and hold for an even count.",
    icon: Wind,
  },
];

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function GroundingView() {
  const vm = useGroundingViewModel();

  const selected = groundingCards.find((card) => card.id === vm.technique) ?? groundingCards[2];
  const SelectedIcon = selected.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        label="Grounding tools"
        title="Find steadier ground."
        description="Choose a short practice, set a comfortable pace, and let ECHO keep a private record when you finish."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
        <div className="space-y-6">
          <EchoCard
            title={selected.title}
            description={selected.description}
            action={
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
                {formatTime(vm.remainingSeconds)}
              </span>
            }
            className="relative overflow-hidden bg-[radial-gradient(circle_at_50%_18%,rgba(220,232,214,0.95),transparent_22rem),linear-gradient(145deg,rgba(255,253,247,0.97),rgba(226,237,220,0.78))]"
          >
            <div className="pointer-events-none absolute -left-20 bottom-0 h-60 w-60 rounded-full bg-white/60 blur-3xl" aria-hidden="true" />
            <div className="relative grid min-h-[390px] place-items-center rounded-[1.8rem] border border-[var(--landing-primary-10)] bg-white/50 p-5 sm:p-8">
              <div className="relative text-center">
                <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10 bg-[radial-gradient(circle,hsl(var(--secondary)/0.7),transparent_62%)]" aria-hidden="true" />
                <div className="relative mx-auto grid h-60 w-60 place-items-center rounded-full border border-primary/10 bg-white/45 shadow-[inset_0_0_40px_hsl(var(--secondary)/0.7)] sm:h-72 sm:w-72">
                  <span className="absolute left-7 top-7 grid h-10 w-10 place-items-center rounded-full bg-secondary text-primary shadow-subtle">
                    <SelectedIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <BreathingCircle label={vm.isRunning ? "Follow your breath" : "Ready when you are"} />
                </div>
                <p className="mt-6 text-5xl font-semibold tracking-[-0.06em] text-foreground">
                  {formatTime(vm.remainingSeconds)}
                </p>
                <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={vm.toggleRunning}
                    disabled={vm.remainingSeconds === 0 || vm.isSaving}
                    className="echo-button-primary rounded-full px-6"
                  >
                    {vm.isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {vm.isRunning ? "Pause" : vm.remainingSeconds < vm.totalSeconds ? "Resume" : "Start session"}
                  </button>
                  <button type="button" onClick={vm.reset} className="echo-button-secondary rounded-full px-6">
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </button>
                </div>
                {vm.status ? (
                  <p className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary" role="status">
                    {vm.remainingSeconds === 0 && !vm.isSaving ? <CheckCircle2 className="h-4 w-4" /> : null}
                    {vm.status}
                  </p>
                ) : null}
              </div>
            </div>
          </EchoCard>

          <div className="grid gap-4 md:grid-cols-3">
            {groundingCards.map((card) => {
              const Icon = card.icon;
              const active = vm.technique === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => vm.selectTechnique(card.id)}
                  aria-pressed={active}
                  className={`relative overflow-hidden rounded-[1.6rem] border p-5 text-left shadow-subtle outline-none transition-[transform,background-color,border-color] duration-200 hover:-translate-y-1 focus-visible:ring-4 focus-visible:ring-ring/20 ${
                    active
                      ? "border-primary/40 bg-[linear-gradient(145deg,hsl(var(--secondary)),hsl(var(--card)))]"
                      : "border-border/70 bg-card hover:border-primary/25"
                  }`}
                >
                  {active ? <span className="absolute right-4 top-4 rounded-full bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-primary-foreground">Selected</span> : null}
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--landing-sage-soft)] text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <strong className="mt-4 block text-base text-foreground">{card.title}</strong>
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">{card.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="space-y-5">
          <EchoCard title="Session settings" description="Choose a comfortable pace.">
            <div className="space-y-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Duration</span>
                <select
                  value={vm.durationMinutes}
                  onChange={(event) => vm.selectDuration(Number(event.target.value))}
                  disabled={vm.isRunning}
                  className="echo-input"
                >
                  <option value={2}>2 minutes</option>
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Pace</span>
                <select
                  value={vm.pace}
                  onChange={(event) => vm.selectPace(event.target.value as typeof vm.pace)}
                  disabled={vm.isRunning}
                  className="echo-input"
                >
                  <option value="gentle">Gentle</option>
                  <option value="slower">Slower</option>
                  <option value="steady">Steady</option>
                </select>
              </label>
            </div>
          </EchoCard>

          <EchoCard compact>
            <div className="flex items-center justify-between gap-3">
              <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
              <Sparkles className="h-4 w-4 text-primary/55" aria-hidden="true" />
            </div>
            <p className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-foreground">{vm.completedSessions ?? "—"}</p>
            <p className="mt-1 text-sm text-muted-foreground">private practices completed</p>
          </EchoCard>

          <Link href="/crisis" className="flex items-center gap-3 rounded-2xl border border-danger/30 bg-crisis-soft p-5">
            <ShieldAlert className="h-5 w-5 text-danger" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground">Need urgent help?</span>
          </Link>
          <CrisisHelpCard compact />
        </aside>
      </div>
    </div>
  );
}
