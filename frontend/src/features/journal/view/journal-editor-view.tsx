"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Heart, Leaf, MapPin, MoreHorizontal, Save, Sparkles } from "lucide-react";
import journalLandscape from "../../../../assets/growth-doorway-hill.png";
import type { JournalEntry } from "../model/journal.model";
import { DefaultJournalFilters } from "../model/journal.model";
import { getJournalService } from "@/services/journal/journal-service.factory";
import { useJournalEditorViewModel } from "../view-model/use-journal-editor-view-model";
import { JournalMoodSelector } from "../components/journal-mood-selector";
import { JournalAutosaveStatus } from "../components/journal-autosave-status";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoInlineMessage } from "@/shared/components/feedback/echo-inline-message";
import { PrivacyNotice } from "@/shared/components/echo/privacy-notice";

type TurnDirection = "older" | "newer";

function formatJournalDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function DatePage({ date, wordCount, entry }: { date: Date; wordCount?: number; entry?: JournalEntry }) {
  const dateTitle = entry ? formatJournalDate(entry.createdAt) : new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(date);
  const activeDate = entry ? new Date(`${entry.createdAt}T12:00:00`) : date;
  const dayNumbers = Array.from({ length: 7 }, (_, index) => activeDate.getDate() - 6 + index);
  const note = entry ? entry.summary : wordCount && wordCount > 0 ? `${wordCount} words of care` : "A gentle beginning";

  return (
    <section className="journal-date-page relative h-full overflow-hidden bg-[linear-gradient(145deg,hsl(var(--card))_0%,hsl(var(--secondary)/0.34)_100%)] p-5 sm:p-6 md:p-7">
      <div className="absolute bottom-0 left-0 top-0 w-14 border-r border-border/50 bg-card/70 sm:w-16" aria-hidden="true" />
      <div className="relative ml-10 sm:ml-12">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>
            <p className="mt-3 text-xs font-medium text-muted-foreground">{dateTitle.split(",")[0]}</p>
            <h2 className="mt-1 font-[family-name:var(--font-echo-display)] text-xl text-foreground sm:text-2xl">{dateTitle.replace(`${dateTitle.split(",")[0]}, `, "")}</h2>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-border/65 bg-card text-muted-foreground"><CalendarDays className="h-4 w-4" aria-hidden="true" /></span>
        </div>

        <Image src={journalLandscape} alt="A quiet hill with a white doorway" className="mt-5 h-56 w-full rounded-[1.25rem] object-cover object-center shadow-subtle sm:h-72" priority />
        <blockquote className="mx-auto mt-4 max-w-[20rem] text-center font-[family-name:var(--font-echo-display)] text-base leading-6 text-foreground/80 sm:text-lg sm:leading-7">
          {entry ? `“${entry.excerpt}”` : "“You are allowed to hold a soft place for every version of yourself.”"}
        </blockquote>

        <div className="mt-5 grid grid-cols-7 gap-1 text-center">
          {dayNumbers.map((day) => (
            <span key={day} className={`grid h-8 place-items-center rounded-full text-xs ${day === activeDate.getDate() ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"}`}>{day}</span>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-border/60 bg-card/75 p-3 text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"><Leaf className="h-4 w-4 text-primary" aria-hidden="true" /> {note}</span>
          <p className="mt-1 text-xs text-muted-foreground">{entry ? "This page is private and read only." : "Showing up for yourself is enough."}</p>
        </div>
      </div>
      <div className="absolute bottom-4 left-3 right-3 flex justify-center gap-1.5 sm:bottom-5 sm:left-4 sm:right-4 md:left-auto md:right-auto md:flex-col" aria-hidden="true">
        {dayNumbers.slice(0, 5).map((day) => <span key={`rail-${day}`} className={`hidden h-2 w-2 rounded-full sm:block ${day === activeDate.getDate() ? "bg-primary" : "bg-border"}`} />)}
      </div>
    </section>
  );
}

function PastReflectionPage({ entry }: { entry: JournalEntry }) {
  return (
    <section className="journal-past-page relative h-full bg-card p-5 sm:p-6 lg:p-7">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> Past reflection</span>
        <span className={`mood-badge mood-badge-${entry.mood}`}>{entry.mood}</span>
      </div>

      <div className="mt-4 rounded-[1.35rem] border border-border/55 bg-[linear-gradient(135deg,hsl(var(--secondary)/0.55),hsl(var(--card)))] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">A private page from {formatJournalDate(entry.createdAt)}</p>
        <h2 className="mt-2 font-[family-name:var(--font-echo-display)] text-xl leading-7 text-foreground sm:text-2xl">{entry.title}</h2>
      </div>

      <div className="mt-4 min-h-32 rounded-xl border border-transparent bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_31px,hsl(var(--border)/0.55)_32px)] px-3 py-2 text-sm leading-8 text-foreground sm:min-h-36">
        <p className="whitespace-pre-line">{entry.body}</p>
      </div>

      <div className="mt-3 rounded-2xl border border-border/60 bg-background/60 p-3">
        <p className="text-xs font-semibold text-primary">A note to hold onto</p>
        <p className="mt-1.5 text-sm leading-5 text-muted-foreground">{entry.perspective ?? entry.summary}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {entry.tags.map((tag) => <span key={tag} className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">{tag}</span>)}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Leaf className="h-4 w-4 text-primary" aria-hidden="true" /> Private by design</span>
        <Link href={`/journal/${entry.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-card px-4 text-sm font-semibold text-foreground outline-none transition hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/20"><BookOpen className="h-4 w-4" aria-hidden="true" /> Open reflection</Link>
      </div>
    </section>
  );
}

export function JournalEditorView() {
  const router = useRouter();
  const [history, setHistory] = useState<JournalEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [turnDirection, setTurnDirection] = useState<TurnDirection>("older");
  const [pendingPageIndex, setPendingPageIndex] = useState<number | null>(null);
  const {
    title, body, mood, tags, analysisConsent,
    wordCount, charCount, isSaving, autosaveStatus, error, fieldErrors,
    savedEntry,
    setTitle, setBody, setMood, setTags, setAnalysisConsent,
    save, reset,
  } = useJournalEditorViewModel();

  useEffect(() => {
    if (savedEntry) {
      reset();
      router.push(`/journal/${savedEntry.id}`);
    }
  }, [savedEntry, reset, router]);

  useEffect(() => {
    const controller = new AbortController();
    void getJournalService().listEntries(DefaultJournalFilters, 1, 6, controller.signal).then((result) => {
      if (!controller.signal.aborted && result.success) setHistory(result.data.entries);
      if (!controller.signal.aborted) setHistoryLoading(false);
    });
    return () => controller.abort();
  }, []);

  const today = useMemo(() => new Date(), []);
  const pages = useMemo(() => [{ id: "today", entry: null }, ...history.map((entry) => ({ id: entry.id, entry }))], [history]);
  const activePage = pages[pageIndex] ?? pages[0];
  const currentEntry = activePage.entry;
  const tagText = tags.join(", ");
  const canGoOlder = pageIndex < pages.length - 1;
  const canGoNewer = pageIndex > 0;
  const isTurning = pendingPageIndex !== null;

  const movePage = (direction: TurnDirection) => {
    if (isTurning) return;
    const nextIndex = direction === "older" ? pageIndex + 1 : pageIndex - 1;
    if (nextIndex < 0 || nextIndex >= pages.length) return;
    setTurnDirection(direction);
    setPendingPageIndex(nextIndex);
  };

  const completePageTurn = () => {
    if (pendingPageIndex === null) return;
    setPageIndex(pendingPageIndex);
    setPendingPageIndex(null);
  };

  const pageLabel = currentEntry ? `Reflection ${pageIndex} of ${pages.length - 1}: ${currentEntry.title}` : "Today’s new reflection";

  return (
    <div className="mx-auto max-w-[1580px]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Private journal</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">A page for today</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/journal" className="text-sm font-semibold text-primary outline-none focus-visible:ring-4 focus-visible:ring-ring/20">Reflection history</Link>
          <div className="inline-flex items-center rounded-xl border border-border/70 bg-card p-1 shadow-subtle md:hidden" role="group" aria-label="Journal page navigation">
            <button type="button" onClick={() => movePage("older")} disabled={!canGoOlder || isTurning} className="grid h-9 w-9 place-items-center rounded-lg text-foreground outline-none transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-4 focus-visible:ring-ring/20" aria-label="Previous reflection"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></button>
            <span className="min-w-[5.5rem] px-2 text-center text-xs font-semibold text-muted-foreground" aria-live="polite">{currentEntry ? `${pageIndex} of ${pages.length - 1}` : historyLoading ? "Loading…" : "Today"}</span>
            <button type="button" onClick={() => movePage("newer")} disabled={!canGoNewer || isTurning} className="grid h-9 w-9 place-items-center rounded-lg text-foreground outline-none transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-4 focus-visible:ring-ring/20" aria-label="Next reflection"><ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{pageLabel}</p>
      <div className="journal-book" aria-label="Journal book spread">
        <button type="button" onClick={() => movePage("older")} disabled={!canGoOlder || isTurning} className="journal-book-nav journal-book-nav--previous" aria-label="Previous reflection"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></button>
        <div key={activePage.id} className={`journal-book-spread ${isTurning ? `journal-book-spread--turning-${turnDirection}` : ""}`}>
          <div className="journal-book-leaf journal-book-leaf--left">
            <div onAnimationEnd={completePageTurn} className="journal-book-page journal-book-page--left">
              <DatePage date={today} wordCount={wordCount} entry={currentEntry ?? undefined} />
            </div>
          </div>
          <div className="journal-book-leaf journal-book-leaf--right">
            <div onAnimationEnd={completePageTurn} className="journal-book-page journal-book-page--right">
              {currentEntry ? <PastReflectionPage entry={currentEntry} /> : (
                <section className="journal-entry-page relative h-full bg-card p-5 sm:p-6 lg:p-7">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground"><Leaf className="h-3.5 w-3.5" aria-hidden="true" /> Save the moment</span>
                <div className="flex items-center gap-2"><JournalAutosaveStatus autosaveStatus={autosaveStatus} isSaving={isSaving} /><button type="button" aria-label="More journal options" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.97]"><MoreHorizontal className="h-5 w-5" aria-hidden="true" /></button></div>
              </div>

              <div className="mt-4 rounded-[1.35rem] border border-border/55 bg-[linear-gradient(135deg,hsl(var(--secondary)/0.55),hsl(var(--card)))] p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-primary"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> A prompt, if it helps</p>
                <p className="mt-2 font-[family-name:var(--font-echo-display)] text-lg leading-7 text-foreground sm:text-xl">What deserves a little more gentleness from you today?</p>
                <div className="mt-3 flex items-center gap-3 text-muted-foreground"><Heart className="h-4 w-4" aria-hidden="true" /><span className="h-4 w-px bg-border" /><span className="text-xs">You can write as little or as much as you need.</span></div>
              </div>

              {error ? <div className="mt-4"><EchoInlineMessage variant="error" message={error} /></div> : null}
              <div className="mt-5"><label htmlFor="journal-title" className="sr-only">Title</label><input id="journal-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="Give this moment a name (optional)" className={`w-full border-b bg-transparent pb-3 text-base font-semibold text-foreground outline-none transition-colors placeholder:text-muted-foreground/65 focus:border-primary ${fieldErrors.title ? "border-danger" : "border-border/70"}`} />{fieldErrors.title ? <p className="mt-1 text-xs text-danger">{fieldErrors.title[0]}</p> : null}</div>
              <div className="mt-4"><div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="journal-body" className="text-xs font-medium text-muted-foreground">Start writing...</label><span className="text-[11px] text-muted-foreground">{wordCount} words · {charCount} characters</span></div><textarea id="journal-body" value={body} onChange={(event) => setBody(event.target.value)} placeholder="There is no right way to begin. Notice what feels present, then let the page meet you there." className={`min-h-52 w-full resize-none rounded-xl border bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_31px,hsl(var(--border)/0.55)_32px)] px-3 py-2 text-sm leading-8 text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/55 focus:border-primary focus:ring-4 focus:ring-primary/10 sm:min-h-60 ${fieldErrors.body ? "border-danger" : "border-transparent"}`} />{fieldErrors.body ? <p className="mt-1 text-xs text-danger">{fieldErrors.body[0]}</p> : null}</div>
              <div className="journal-mood-panel mt-4 rounded-2xl border border-border/60 bg-background/60 p-3">
                <JournalMoodSelector value={mood} onChange={setMood} />
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <label className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <input type="checkbox" checked={analysisConsent} onChange={(event) => setAnalysisConsent(event.target.checked)} className="h-4 w-4 rounded border-input text-primary focus:ring-primary/20" />
                    Allow a reflective summary after saving
                  </label>
                  <label htmlFor="journal-tags" className="sr-only">Tags</label>
                  <input id="journal-tags" value={tagText} onChange={(event) => setTags(event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))} placeholder="tags: rest, work" className="h-9 rounded-xl border border-border/70 bg-card px-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/10" />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-4 w-4 text-primary" aria-hidden="true" /> Write from wherever you are.</span><EchoButton variant="primary" size="medium" isLoading={isSaving} onClick={save}><Save className="h-4 w-4" aria-hidden="true" /> Save reflection</EchoButton></div>
              <div className="journal-privacy-notice mt-4"><PrivacyNotice /></div>
                </section>
              )}
            </div>
          </div>
        </div>
        <button type="button" onClick={() => movePage("newer")} disabled={!canGoNewer || isTurning} className="journal-book-nav journal-book-nav--next" aria-label="Next reflection"><ArrowRight className="h-5 w-5" aria-hidden="true" /></button>
      </div>
    </div>
  );
}
