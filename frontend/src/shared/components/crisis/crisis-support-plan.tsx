"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, HeartHandshake, MessageCircle, Phone, ShieldAlert, Siren, Wind } from "lucide-react";
import { experienceApi, type SupportResource } from "@/services/experience/experience-api";

const immediateSteps = [
  "Call local emergency services now if someone may be in immediate danger.",
  "Move toward another person or a safer, more public place if you can do so safely.",
  "Contact someone you trust and say: “I need you to stay with me or help me call for support.”",
  "Put distance between yourself and anything you could use to hurt yourself or someone else, if it is safe to do so.",
];

export function CrisisSupportPlan() {
  const [completed, setCompleted] = useState<Set<number>>(() => new Set());
  const [resources, setResources] = useState<SupportResource[]>([]);
  const [resourceError, setResourceError] = useState(false);
  const [breathingOpen, setBreathingOpen] = useState(false);
  const [breathStep, setBreathStep] = useState(0);

  useEffect(() => {
    let isActive = true;
    void experienceApi.getSupportResources({ type: "crisis_hotline" })
      .then((items) => { if (isActive) setResources(items.slice(0, 3)); })
      .catch(() => { if (isActive) setResourceError(true); });
    return () => { isActive = false; };
  }, []);

  const toggleStep = (index: number) => {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const breath = ["Breathe in gently for 4", "Hold only if comfortable for 2", "Breathe out slowly for 6", "Pause and notice one steady thing"];

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] border border-danger/25 bg-[radial-gradient(circle_at_8%_0%,hsl(var(--crisis-soft)),transparent_26rem),linear-gradient(135deg,hsl(var(--card)),hsl(var(--background)))] p-5 shadow-soft sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-danger/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[1.2rem] bg-crisis text-danger-foreground shadow-[0_14px_28px_hsl(var(--crisis)/0.22)]">
            <Siren className="h-7 w-7" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-danger">Immediate support</p>
            <h1 className="mt-2 max-w-3xl font-serif text-[clamp(2.25rem,7vw,4.75rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-foreground">
              Get help now.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
              ECHO is not emergency monitoring. If there is immediate danger, contact emergency services now.
            </p>
          </div>
        </div>
        <div className="relative mt-6 grid gap-3 md:grid-cols-3">
          <a href="tel:911" className="echo-button-primary min-h-13 justify-center rounded-[1.1rem] bg-crisis text-danger-foreground hover:bg-crisis/90">
            <Phone className="h-4 w-4" />
            Call emergency services
          </a>
          <a href="tel:988" className="echo-button-secondary min-h-13 justify-center rounded-[1.1rem] border-danger/25 bg-white/65">
            <Phone className="h-4 w-4 text-danger" />
            Call or text 988
          </a>
          <a href="https://988lifeline.org/chat/" target="_blank" rel="noreferrer" className="echo-button-secondary min-h-13 justify-center rounded-[1.1rem] bg-secondary/80">
            <MessageCircle className="h-4 w-4" />
            Chat with 988 <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-[1.65rem] border border-border/70 bg-card/92 p-5 shadow-card sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-foreground">Next safe step</h2>
            <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
              choose one
            </span>
          </div>
          <ol className="mt-4 grid gap-2">
            {immediateSteps.map((step, index) => {
              const done = completed.has(index);
              return (
                <li key={step}>
                  <button
                    type="button"
                    onClick={() => toggleStep(index)}
                    aria-pressed={done}
                    className="group flex w-full items-start gap-3 rounded-[1.1rem] border border-border/60 bg-background/70 p-3 text-left text-sm leading-5 transition-[transform,background-color,border-color] duration-150 ease-out hover:border-primary/25 hover:bg-secondary/50 focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.99]"
                  >
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${done ? "border-primary bg-primary text-primary-foreground" : "border-primary/30 text-transparent group-hover:text-primary/30"}`}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                    <span>{step}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="rounded-[1.65rem] border border-[var(--landing-primary-15)] bg-[linear-gradient(145deg,rgba(226,237,220,0.88),rgba(255,253,247,0.98))] p-5 shadow-card sm:p-6">
          <div className="flex items-center gap-2 text-primary">
            <Wind className="h-5 w-5" />
            <h2 className="font-semibold">Steady while waiting</h2>
          </div>
          {breathingOpen ? (
            <div className="mt-5 rounded-[1.35rem] border border-white/70 bg-white/70 p-4 text-center">
              <p className="font-serif text-2xl leading-7 text-foreground">{breath[breathStep]}</p>
              <button type="button" onClick={() => setBreathStep((current) => (current + 1) % breath.length)} className="echo-button-primary mt-4">
                Next cue
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setBreathingOpen(true)} className="echo-button-secondary mt-5 w-full justify-center">
              <Wind className="h-4 w-4" />
              Start breathing cue
            </button>
          )}
          <Link href="/tools/grounding" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline">
            <HeartHandshake className="h-4 w-4" />
            More grounding
          </Link>
        </div>
      </section>

      <section className="rounded-[1.65rem] border border-border/70 bg-card/92 p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Verified resources</h2>
          <Link href="/support/find-help" className="echo-button-secondary">Find local help</Link>
        </div>
        {resourceError ? (
          <p role="alert" className="mt-4 rounded-xl border border-danger/25 bg-crisis-soft p-3 text-sm text-foreground">
            Directory unavailable. If danger is immediate, call emergency services.
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {resources.map((resource) => (
            <article key={resource.id} className="rounded-[1.1rem] border border-border/60 bg-background/70 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-primary">{resource.organizationName}</p>
              <h3 className="mt-1 font-semibold text-foreground">{resource.name}</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{resource.availability || resource.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {resource.phoneNumber ? <a href={`tel:${resource.phoneNumber.replace(/[^\d+]/g, "")}`} className="echo-button-primary h-9 px-3 text-xs"><Phone className="h-3.5 w-3.5" />Call</a> : null}
                {resource.websiteUrl ? <a href={resource.websiteUrl} target="_blank" rel="noreferrer" className="echo-button-secondary h-9 px-3 text-xs">Website <ExternalLink className="h-3.5 w-3.5" /></a> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
