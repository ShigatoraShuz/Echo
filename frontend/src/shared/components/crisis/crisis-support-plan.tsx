"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronRight, ExternalLink, Info, MapPin, Phone, RotateCcw, ShieldCheck, Wind, X } from "lucide-react";
import { experienceApi, type SupportResource } from "@/services/experience/experience-api";

const immediateSteps = [
  { title: "Call for help.", description: "Call local emergency services now if someone may be in immediate danger." },
  { title: "Move to a safer place.", description: "Go to a safer, more public place if you can do so safely." },
  { title: "Reach out to someone you trust.", description: "Tell a friend, family member, or someone you trust: “I need you to stay with me or help me call for support.”" },
  { title: "Create space.", description: "Put distance between yourself and anything you could use to hurt yourself or someone else, if it is safe to do so." },
];

const breath = ["Breathe in gently for 4", "Hold only if comfortable for 2", "Breathe out slowly for 6", "Pause and notice one steady thing"];

function httpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function verifiedSource(resource: SupportResource): { url: string; date: string } | null {
  const url = httpsUrl(resource.verificationSource);
  const checkedAt = new Date(resource.lastVerifiedAt);
  if (!url || Number.isNaN(checkedAt.getTime()) || checkedAt.getTime() > Date.now()) return null;
  return { url, date: checkedAt.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) };
}

export function CrisisSupportPlan() {
  const [completed, setCompleted] = useState<Set<number>>(() => new Set());
  const [resources, setResources] = useState<SupportResource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [resourceError, setResourceError] = useState(false);
  const [resourceAttempt, setResourceAttempt] = useState(0);
  const [breathingOpen, setBreathingOpen] = useState(false);
  const [breathStep, setBreathStep] = useState(0);

  useEffect(() => {
    let isActive = true;
    setResourcesLoading(true);
    setResourceError(false);
    void experienceApi.getSupportResources({ type: "crisis_hotline" })
      .then((items) => { if (isActive) setResources(items.filter((item) => verifiedSource(item) !== null)); })
      .catch(() => {
        if (isActive) {
          setResources([]);
          setResourceError(true);
        }
      })
      .finally(() => { if (isActive) setResourcesLoading(false); });
    return () => { isActive = false; };
  }, [resourceAttempt]);

  const toggleStep = (index: number) => {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex min-h-[4.5rem] max-w-[76rem] items-center justify-between gap-3 border-b border-primary/15 px-4 sm:px-8">
        <Link href="/" className="inline-flex min-h-11 items-center gap-3 rounded-md text-primary focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-primary">
          <span className="text-lg font-extrabold tracking-[-0.04em]">ECHO</span>
          <span aria-hidden="true" className="hidden text-muted-foreground sm:inline">/</span>
          <span className="hidden text-sm font-medium text-muted-foreground sm:inline">Crisis support</span>
        </Link>
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Return to ECHO
        </Link>
      </header>

      <section aria-labelledby="crisis-heading" className="mx-auto grid max-w-[76rem] gap-7 px-4 pb-9 pt-5 sm:px-8 sm:pb-12 sm:pt-9 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] lg:items-center lg:gap-14 lg:py-14">
        <div className="order-2 pb-3 lg:order-1 lg:pb-0">
          <h1 id="crisis-heading" className="font-serif text-[clamp(2.75rem,5vw,4.5rem)] font-semibold leading-[0.94] tracking-[-0.035em] text-foreground sm:text-[clamp(3.2rem,5vw,4.5rem)]"><span className="lg:block lg:whitespace-nowrap">You can reach </span><span className="lg:block lg:whitespace-nowrap">someone now.</span></h1>
          <p className="mt-5 text-xl leading-7 text-foreground/85 sm:text-2xl">You do not have to handle this alone.</p>
          <p className="mt-6 max-w-[55ch] text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">If there is immediate danger, contact emergency services now. ECHO is not emergency monitoring.</p>
          <p className="mt-5 flex max-w-[55ch] items-start gap-3 text-sm leading-6 text-muted-foreground">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <span>These numbers serve the Philippines. Elsewhere, contact your local emergency service.</span>
          </p>
        </div>

        <aside aria-label="Immediate call options" className="order-1 rounded-2xl bg-[#edf1ea] p-4 sm:p-6 lg:order-2 lg:p-7">
          <div className="space-y-3">
            <a href="tel:911" aria-label="Call emergency services 911" className="echo-emergency-link flex min-h-[5.75rem] items-center gap-4 rounded-xl bg-crisis px-4 py-3 text-white transition-colors duration-150 hover:bg-[#a7261d] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[5px] focus-visible:outline-[#173d32] sm:px-6">
              <Phone className="h-8 w-8 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold leading-5 sm:text-base">Call emergency services</span><span className="mt-1 block text-xs leading-4 text-white/90 sm:text-sm">If there is immediate danger.</span></span>
              <span className="border-l border-white/45 pl-4 font-serif text-4xl font-semibold leading-none tabular-nums sm:pl-6 sm:text-5xl">911</span>
            </a>
            <a href="tel:1553" aria-label="Call NCMH Crisis Hotline 1553" className="flex min-h-[5.75rem] items-center gap-4 rounded-xl bg-primary px-4 py-3 text-primary-foreground transition-colors duration-150 hover:bg-[#174536] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[5px] focus-visible:outline-[#173d32] sm:px-6">
              <Phone className="h-8 w-8 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold leading-5 sm:text-base">Call NCMH Crisis Hotline</span><span className="mt-1 block text-xs leading-4 text-primary-foreground/90 sm:text-sm">Compassionate support, day or night.</span></span>
              <span className="border-l border-primary-foreground/45 pl-4 font-serif text-3xl font-semibold leading-none tabular-nums sm:pl-6 sm:text-4xl">1553</span>
            </a>
          </div>
          <p className="mt-4 flex items-start gap-3 rounded-xl border border-primary/20 px-4 py-3 text-sm leading-5 text-foreground/80">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <span>If a line does not connect, try another listed number or go to the nearest emergency department.</span>
          </p>
        </aside>
      </section>

      <section aria-labelledby="safe-steps-heading" className="bg-[#edf2ed]">
        <div className="mx-auto max-w-[76rem] px-4 py-11 sm:px-8 sm:py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="safe-steps-heading" className="font-serif text-4xl font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-5xl">Choose one safe step.</h2>
              <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground sm:text-base">You do not need to finish the whole list. Start with the step that feels possible.</p>
            </div>
            <p className="text-sm font-semibold tabular-nums text-primary" aria-live="polite">{completed.size} of {immediateSteps.length} marked</p>
          </div>
          <ol className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {immediateSteps.map((step, index) => {
              const done = completed.has(index);
              return (
                <li key={step.title} className="min-w-0">
                  <button type="button" onClick={() => toggleStep(index)} aria-pressed={done} className="group flex h-full min-h-56 w-full flex-col rounded-xl border border-primary/15 bg-[#fffdf8] p-5 text-left transition-colors duration-150 hover:border-primary/40 hover:bg-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-primary">
                    <span aria-hidden="true" className={`grid h-11 w-11 place-items-center rounded-full border text-lg font-bold tabular-nums ${done ? "border-primary bg-primary text-primary-foreground" : "border-primary/20 bg-[#e4eee7] text-primary"}`}>{done ? <Check className="h-5 w-5" /> : index + 1}</span>
                    <span className="mt-5 block font-serif text-2xl font-semibold leading-6 text-foreground">{step.title}</span>
                    <span className="mt-2 block flex-1 text-sm leading-5 text-muted-foreground">{step.description}</span>
                    <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-primary"><span aria-hidden="true" className={`grid h-5 w-5 place-items-center rounded-full border border-primary ${done ? "bg-primary text-primary-foreground" : ""}`}>{done ? <Check className="h-3 w-3" /> : null}</span>{done ? "Marked done" : "Mark when complete"}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <aside aria-labelledby="breathing-heading" className="mt-5 grid gap-5 rounded-xl bg-[#dce8df] p-6 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.6fr)] lg:items-center">
            <div>
              <h2 id="breathing-heading" className="font-serif text-3xl font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-4xl">Slow the next minute down.</h2>
              <p className="mt-2 max-w-[55ch] text-sm leading-6 text-muted-foreground">Use a breathing cue while you wait for someone to answer. Stop if it feels uncomfortable.</p>
            </div>
            <div className="flex flex-col gap-3">
              {breathingOpen ? (
                <>
                  <p className="text-xs font-semibold text-primary">Cue {breathStep + 1} of {breath.length}</p>
                  <p aria-live="polite" className="font-serif text-2xl font-semibold leading-7 text-foreground">{breath[breathStep]}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setBreathStep((current) => (current + 1) % breath.length)} className="echo-button-primary flex-1">Next cue <ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
                    <button type="button" onClick={() => { setBreathingOpen(false); setBreathStep(0); }} className="echo-button-secondary flex-1 bg-transparent"><X className="h-4 w-4" aria-hidden="true" /> End cue</button>
                  </div>
                </>
              ) : <button type="button" onClick={() => setBreathingOpen(true)} className="echo-button-primary w-full"><Wind className="h-4 w-4" aria-hidden="true" /> Start breathing cue</button>}
            </div>
          </aside>
        </div>
      </section>

      <section aria-labelledby="resources-heading" className="mx-auto max-w-[76rem] px-4 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h2 id="resources-heading" className="font-serif text-4xl font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-5xl">More support</h2>
            <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground sm:text-base">Philippine crisis resources are reviewed against linked sources. Call first when you need immediate help.</p>
          </div>
          <Link href="/support/find-help" className="echo-button-secondary bg-transparent">Find local help <ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
        {resourceError ? (
          <div role="alert" className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-crisis-soft p-5">
            <p className="text-sm leading-6 text-foreground">The directory is unavailable. The emergency numbers above are still available.</p>
            <button type="button" onClick={() => setResourceAttempt((current) => current + 1)} className="echo-button-secondary bg-background"><RotateCcw className="h-4 w-4" aria-hidden="true" /> Try again</button>
          </div>
        ) : null}
        {resourcesLoading ? <div role="status" className="mt-6 space-y-3"><span className="sr-only">Loading verified crisis resources…</span>{[0, 1].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl bg-secondary/50 motion-reduce:animate-none" />)}</div> : null}
        {!resourcesLoading && !resourceError && resources.length === 0 ? <p role="status" className="mt-6 rounded-xl border border-primary/15 p-5 text-sm leading-6 text-muted-foreground">No additional directory entries are available right now. The emergency numbers above remain available.</p> : null}
        {!resourcesLoading && resources.length > 0 ? (
          <div className="mt-6 grid gap-3">
            {resources.map((resource) => {
              const source = verifiedSource(resource);
              const website = httpsUrl(resource.websiteUrl);
              return (
                <article key={resource.id} className="grid gap-5 rounded-xl border border-primary/15 bg-[#fffdf8] p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-primary">{resource.organizationName}</p>
                    <h3 className="mt-2 font-serif text-2xl font-semibold leading-tight text-foreground">{resource.name}</h3>
                    <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground">{resource.description}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{resource.availability}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    {source ? <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-primary">Official source · checked {source.date} <ExternalLink className="h-4 w-4" aria-hidden="true" /></a> : null}
                    {resource.phoneNumber ? <a href={`tel:${resource.phoneNumber.replace(/[^\d+]/g, "")}`} aria-label={`Call ${resource.name} at ${resource.phoneNumber}`} className="echo-button-primary"><Phone className="h-4 w-4" aria-hidden="true" /> Call {resource.phoneNumber}</a> : null}
                    {website ? <a href={website} target="_blank" rel="noopener noreferrer" className="echo-button-secondary bg-transparent">Website <ExternalLink className="h-4 w-4" aria-hidden="true" /></a> : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      <footer className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-[76rem] flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs leading-5 sm:px-8">
          <p className="flex items-start gap-2"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" /><span>ECHO provides support options and does not replace emergency or professional care.</span></p>
          <span className="font-bold tracking-[0.2em]">ECHO</span>
        </div>
      </footer>
    </div>
  );
}
