"use client";

import Link from "next/link";
import { ArrowRight, Clock, FileText, Lock, Sparkles } from "lucide-react";
import type { JournalEntry } from "../model/journal.model";
import {
  formatJournalDate,
  getMoodVisual,
  calculateReadingTime,
} from "../utils/journal-formatters";

interface JournalTimelineEntryProps {
  entry: JournalEntry;
  isLast?: boolean;
}

export function JournalTimelineEntry({ entry, isLast = false }: JournalTimelineEntryProps) {
  const { timeString, relativeTime, dayNumber, monthName, weekday } = formatJournalDate(entry.createdAt);
  const moodVisual = getMoodVisual(entry.mood);
  const { words, readingTime } = calculateReadingTime(entry.body || entry.excerpt);

  return (
    <article className="group relative flex items-start gap-4 sm:gap-6">
      {/* ── Left Timeline Spine ────────────────────────────────────── */}
      <div className="relative flex flex-col items-center">
        {/* Date square pill */}
        <div className="flex h-14 w-12 flex-col items-center justify-center rounded-2xl border border-[var(--landing-primary-15)] bg-white/90 shadow-sm transition-transform duration-200 group-hover:scale-105 sm:h-16 sm:w-14">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--landing-muted)]">
            {monthName}
          </span>
          <span className="text-lg font-black leading-none text-[var(--landing-ink)] sm:text-xl">
            {dayNumber}
          </span>
          <span className="text-[9px] font-medium text-[var(--landing-muted)]">
            {weekday}
          </span>
        </div>

        {/* Node marker with mood color */}
        <div
          className="my-2 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm ring-2"
          style={{
            backgroundColor: moodVisual.dotColor,
            borderColor: "white",
          }}
          aria-hidden="true"
        />

        {/* Connecting spine line */}
        {!isLast && (
          <div
            className="w-0.5 flex-1 bg-[var(--landing-primary-10)]"
            style={{ minHeight: "48px" }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* ── Main Content Card ──────────────────────────────────────── */}
      <div
        className="relative mb-6 flex-1 overflow-hidden rounded-[1.75rem] border border-[var(--landing-primary-15)] bg-white p-5 shadow-[0_8px_30px_rgba(47,53,39,0.06)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_16px_40px_rgba(47,53,39,0.1)] sm:p-6"
        style={{
          borderLeftWidth: "4px",
          borderLeftColor: moodVisual.dotColor,
        }}
      >
        {/* Top Meta Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Mood pill badge */}
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold text-xs shadow-xs"
              style={{
                backgroundColor: moodVisual.badgeBg,
                color: moodVisual.badgeText,
              }}
            >
              <span>{moodVisual.emoji}</span>
              <span>{moodVisual.label}</span>
            </span>

            {/* Time & relative indicator */}
            <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--landing-muted)]">
              <Clock className="h-3 w-3" aria-hidden="true" />
              <span>{timeString}</span>
              <span className="text-black/30">·</span>
              <span>{relativeTime}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Privacy indicator */}
            <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--landing-muted)]">
              <Lock className="h-3 w-3 text-[var(--landing-primary)]" aria-hidden="true" />
              <span>Private</span>
            </span>

            {/* AI analysis badge if consented */}
            {entry.analysisConsent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--landing-primary-10)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--landing-primary)]">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                <span>Reflected</span>
              </span>
            )}
          </div>
        </div>

        {/* Title and Excerpt */}
        <div className="mt-3.5">
          <Link
            href={`/journal/${entry.id}`}
            className="group/title inline-block outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
          >
            <h2 className="text-xl font-bold tracking-tight text-[var(--landing-ink)] transition-colors duration-150 group-hover/title:text-[var(--landing-primary)] sm:text-2xl [font-family:var(--font-echo-display)]">
              {entry.title || "Untitled reflection"}
            </h2>
          </Link>

          <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted)] line-clamp-3">
            {entry.excerpt || entry.body || "No content preview available."}
          </p>
        </div>

        {/* Bottom Bar: Tags, Words, Reading Link */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-3.5">
          {/* Tags */}
          <div className="flex flex-wrap items-center gap-1.5">
            {entry.tags.length > 0 ? (
              entry.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-black/5 px-2.5 py-0.5 text-[11px] font-medium text-[var(--landing-muted)]"
                >
                  #{tag}
                </span>
              ))
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-[var(--landing-muted)]">
                <FileText className="h-3 w-3" aria-hidden="true" />
                <span>{words} words · {readingTime}</span>
              </span>
            )}
          </div>

          {/* Action Link */}
          <Link
            href={`/journal/${entry.id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--landing-primary-10)] px-3.5 py-1.5 text-xs font-bold text-[var(--landing-primary)] outline-none transition-all duration-150 hover:bg-[var(--landing-primary)] hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-600/30 active:scale-[0.98]"
          >
            <span>Read page</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
