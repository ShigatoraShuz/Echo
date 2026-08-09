"use client";
import Link from "next/link";
import { CheckCircle2, Clock, HandHeart, Leaf, Pause, Play, RotateCcw, ShieldAlert, Wind } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <PageHeader
        label="Grounding tools"
        title="Find steadier ground."
        description="Choose a short practice, set a comfortable pace, and let ECHO keep a private record when you finish."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_370px]">
        <div className="space-y-6">
          <EchoCard
            title={selected.title}
            description={selected.description}
            action={
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
                {formatTime(vm.remainingSeconds)}
              </span>
            }
            className="overflow-hidden bg-[linear-gradient(145deg,rgba(255,253,247,0.94),rgba(220,232,214,0.78))]"
          >
            <div className="grid min-h-[360px] place-items-center rounded-[1.6rem] border border-[var(--landing-primary-10)] bg-white/55 p-6">
              <div className="text-center">
                <BreathingCircle label={vm.isRunning ? "Follow your breath" : "Ready when you are"} />
                <p className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-foreground">
                  {formatTime(vm.remainingSeconds)}
                </p>
                <div className="mt-5 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={vm.toggleRunning}
                    disabled={vm.remainingSeconds === 0 || vm.isSaving}
                    className="echo-button-primary"
                  >
                    {vm.isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {vm.isRunning ? "Pause" : vm.remainingSeconds < vm.totalSeconds ? "Resume" : "Start session"}
                  </button>
                  <button type="button" onClick={vm.reset} className="echo-button-secondary">
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

          <div className="grid gap-5 md:grid-cols-3">
            {groundingCards.map((card) => {
              const Icon = card.icon;
              const active = vm.technique === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => vm.selectTechnique(card.id)}
                  aria-pressed={active}
                  className={`rounded-[1.5rem] border p-5 text-left shadow-subtle outline-none transition-[transform,background-color,border-color] duration-200 hover:-translate-y-1 focus-visible:ring-4 focus-visible:ring-ring/20 ${
                    active
                      ? "border-primary/35 bg-secondary"
                      : "border-border/70 bg-card hover:border-primary/25"
                  }`}
                >
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

        <aside className="space-y-6">
          <EchoCard title="Session settings" description="Choose a pace that feels comfortable.">
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
            <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="mt-4 text-3xl font-semibold text-foreground">{vm.completedSessions ?? "—"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              completed practice{vm.completedSessions === 1 ? "" : "s"} recorded privately
            </p>
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