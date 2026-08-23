"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, HeartHandshake, MessageCircle, Phone, ShieldAlert, Wind } from "lucide-react";
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
      <section className="rounded-[1.75rem] border border-danger/30 bg-card p-5 shadow-soft sm:p-7">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-crisis text-danger-foreground"><ShieldAlert className="h-6 w-6" aria-hidden="true" /></span>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-danger">Immediate support</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">You deserve support right now.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">ECHO is not an emergency service and does not monitor crises. If there is immediate danger, call local emergency services now.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <a href="tel:911" className="echo-button-primary min-h-12 justify-center bg-crisis text-danger-foreground hover:bg-crisis/90"><Phone className="h-4 w-4" />Call emergency services</a>
          <a href="tel:988" className="echo-button-secondary min-h-12 justify-center border-danger/25 bg-crisis-soft"><Phone className="h-4 w-4 text-danger" />US: Call or text 988</a>
          <a href="https://988lifeline.org/chat/" target="_blank" rel="noreferrer" className="echo-button-secondary min-h-12 justify-center"><MessageCircle className="h-4 w-4" />US: Chat with 988 <ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">988 is a United States service. If you are elsewhere, use your local emergency number or the verified resource directory below.</p>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.5rem] border border-border/70 bg-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">Do the next safe thing</h2>
          <p className="mt-1 text-sm text-muted-foreground">You do not need to do every step. Choose one that is possible now.</p>
          <ol className="mt-4 space-y-2">
            {immediateSteps.map((step, index) => {
              const done = completed.has(index);
              return <li key={step}><button type="button" onClick={() => toggleStep(index)} aria-pressed={done} className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-3 text-left text-sm leading-5 transition-[transform,background-color,border-color] duration-150 ease-out hover:border-primary/25 hover:bg-secondary/50 focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.99]">
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${done ? "border-primary bg-primary text-primary-foreground" : "border-primary/30 text-transparent"}`}><CheckCircle2 className="h-3.5 w-3.5" /></span>{step}
              </button></li>;
            })}
          </ol>
        </div>
        <div className="rounded-[1.5rem] border border-[var(--landing-primary-15)] bg-[linear-gradient(145deg,rgba(226,237,220,0.8),rgba(255,253,247,0.95))] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-primary"><Wind className="h-5 w-5" /><h2 className="font-semibold">A breath while you wait</h2></div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Only if you are physically safe enough to pause. Breathing is not a substitute for contacting emergency support.</p>
          {breathingOpen ? <div className="mt-4 rounded-2xl bg-white/70 p-4 text-center"><p className="font-serif text-xl text-foreground">{breath[breathStep]}</p><button type="button" onClick={() => setBreathStep((current) => (current + 1) % breath.length)} className="echo-button-primary mt-4">Next gentle cue</button></div> : <button type="button" onClick={() => setBreathingOpen(true)} className="echo-button-secondary mt-4"><Wind className="h-4 w-4" />Start a gentle breath</button>}
          <Link href="/tools/grounding" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"><HeartHandshake className="h-4 w-4" />More grounding options</Link>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-border/70 bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Verified support resources</h2><p className="mt-1 text-sm text-muted-foreground">ECHO only displays active, reviewed resources from the support directory.</p></div><Link href="/support/find-help" className="echo-button-secondary">Find local help</Link></div>
        {resourceError ? <p role="alert" className="mt-4 rounded-xl border border-danger/25 bg-crisis-soft p-3 text-sm text-foreground">The verified directory is unavailable right now. Use local emergency services if there is immediate danger.</p> : null}
        <div className="mt-4 grid gap-3 md:grid-cols-3">{resources.map((resource) => <article key={resource.id} className="rounded-xl border border-border/60 bg-background/70 p-4"><p className="text-xs font-bold uppercase tracking-[0.11em] text-primary">{resource.organizationName}</p><h3 className="mt-1 font-semibold text-foreground">{resource.name}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{resource.availability || resource.description}</p><div className="mt-3 flex flex-wrap gap-2">{resource.phoneNumber ? <a href={`tel:${resource.phoneNumber.replace(/[^\d+]/g, "")}`} className="echo-button-primary h-9 px-3 text-xs"><Phone className="h-3.5 w-3.5" />Call</a> : null}{resource.websiteUrl ? <a href={resource.websiteUrl} target="_blank" rel="noreferrer" className="echo-button-secondary h-9 px-3 text-xs">Website <ExternalLink className="h-3.5 w-3.5" /></a> : null}</div></article>)}</div>
      </section>
    </div>
  );
}
