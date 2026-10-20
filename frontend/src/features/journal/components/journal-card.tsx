"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import journalLandscape from "../../../../assets/growth-doorway-hill.png";
import type { JournalEntry } from "../model/journal.model";
import { formatJournalDate, getMoodVisual } from "../utils/journal-formatters";

export function JournalCard({ entry, index = 0 }: { entry: JournalEntry; index?: number }) {
  const mood = getMoodVisual(entry.mood);
  const date = formatJournalDate(entry.createdAt);
  const firstPhoto = entry.images?.[0];
  const extraPhotos = Math.max(0, (entry.images?.length ?? 0) - 1);

  return (
    <article className="journal-gallery-card group mx-auto w-full max-w-[17rem] min-w-0" style={{ animationDelay: `${Math.min(index, 5) * 55}ms` }}>
      <Link href={`/journal/${entry.id}`} className="journal-gallery-card__link block rounded-[1.25rem] outline-none focus-visible:ring-4 focus-visible:ring-primary/25">
        <div className="bg-white p-3 pb-4 shadow-[0_10px_30px_rgba(33,45,35,0.16)] sm:p-4 sm:pb-5">
          <div className="journal-polaroid__window relative aspect-square overflow-hidden bg-secondary/55">
            {firstPhoto ? (
              <Image src={firstPhoto.url} alt={`Photo from ${entry.title || "your reflection"}`} fill unoptimized referrerPolicy="no-referrer" sizes="(min-width: 640px) 240px, 86vw" className="journal-polaroid__image object-cover object-center" />
            ) : (
              <Image src={journalLandscape} alt="Illustration of a doorway on a hillside" fill sizes="(min-width: 640px) 240px, 86vw" className="journal-polaroid__image object-cover object-center opacity-85" />
            )}
            {extraPhotos > 0 && <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-foreground shadow-sm">+{extraPhotos} photos</span>}
            {!firstPhoto && <span className="absolute bottom-3 left-3 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-medium text-foreground">Illustration</span>}
          </div>
          <div className="flex items-start justify-between gap-2 pt-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{date.relativeTime}</p>
              <h2 className="mt-1 truncate font-[family-name:var(--font-echo-display)] text-xl text-foreground">{entry.title || "Untitled reflection"}</h2>
            </div>
            <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
          </div>
        </div>
      </Link>
      <div className="px-2 pt-3">
        <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">{entry.excerpt || entry.body || "A quiet moment worth keeping."}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium" style={{ color: mood.badgeText }}><span aria-hidden="true">{mood.emoji}</span>{mood.label}</span>
      </div>
    </article>
  );
}
