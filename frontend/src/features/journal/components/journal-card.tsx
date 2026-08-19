"use client";

import Link from "next/link";
import { ArrowRight, Clock, FileText, Lock } from "lucide-react";
import type { JournalEntry } from "../model/journal.model";
import {
  formatJournalDate,
  getMoodVisual,
  calculateReadingTime,
} from "../utils/journal-formatters";

interface JournalCardProps {
  entry: JournalEntry;
}

export function JournalCard({ entry }: JournalCardProps) {
  const { fullDate, timeString, relativeTime } = formatJournalDate(entry.createdAt);
  const moodVisual = getMoodVisual(entry.mood);
  const { words, readingTime } = calculateReadingTime(entry.body || entry.excerpt);

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-[1.75rem] border border-[var(--landing-primary-15)] bg-white p-5 shadow-[0_8px_24px_rgba(47,53,39,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(47,53,39,0.09)] sm:p-6">
      {/* Top Accent Strip with Mood Color */}
      <div
        className="absolute inset-x-0 top-0 h-1.5 transition-opacity duration-200"
        style={{ backgroundColor: moodVisual.dotColor }}
        aria-hidden="true"
      />

      <div>
        {/* Header: Date + Mood Badge */}
        <div className="flex items-start justify-between gap-2 border-b border-black/5 pb-3">
          <div>
            <p className="text-xs font-bold text-[var(--landing-ink)]">
              {relativeTime}
            </p>
            <p className="text-[11px] font-medium text-[var(--landing-muted)]">
              {timeString}
            </p>
          </div>

          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-xs"
            style={{
              backgroundColor: moodVisual.badgeBg,
              color: moodVisual.badgeText,
            }}
          >
            <span>{moodVisual.emoji}</span>
            <span>{moodVisual.label}</span>
          </span>
        </div>

        {/* Title */}
        <Link
          href={`/journal/${entry.id}`}
          className="group/title mt-3.5 block outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
        >
          <h2 className="text-lg font-bold tracking-tight text-[var(--landing-ink)] transition-colors duration-150 group-hover/title:text-[var(--landing-primary)] line-clamp-1 [font-family:var(--font-echo-display)]">
            {entry.title || "Untitled reflection"}
          </h2>
        </Link>

        {/* Excerpt */}
        <p className="mt-2 text-xs leading-relaxed text-[var(--landing-muted)] line-clamp-3">
          {entry.excerpt || entry.body || "No content preview available."}
        </p>
      </div>

      {/* Footer Meta & Link */}
      <div className="mt-5 border-t border-black/5 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          {/* Word count & reading time */}
          <span className="flex items-center gap-1 text-[11px] text-[var(--landing-muted)]">
            <FileText className="h-3 w-3" aria-hidden="true" />
            <span>{words} words</span>
            <span className="text-black/30">·</span>
            <span>{readingTime}</span>
          </span>

          {/* Read button */}
          <Link
            href={`/journal/${entry.id}`}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--landing-primary-10)] px-3 py-1 text-xs font-bold text-[var(--landing-primary)] transition-all duration-150 hover:bg-[var(--landing-primary)] hover:text-white"
          >
            <span>Read</span>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>

        {/* Tags if any */}
        {entry.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {entry.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-black/5 px-2 py-0.5 text-[10px] font-medium text-[var(--landing-muted)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
