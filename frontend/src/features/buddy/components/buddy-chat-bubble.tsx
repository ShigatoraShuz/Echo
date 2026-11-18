"use client";
import { Bot, UserRound, Volume2, Square, LoaderCircle } from "lucide-react";
import type { BuddyMessage } from "../model/buddy.model";
import { cn } from "@/shared/lib/utils";

export function BuddyChatBubble({ message, onReadAloud, speechState, speechError, speechDisabled }: { message: BuddyMessage; onReadAloud?:()=>void; speechState?:'preparing'|'playing'; speechError?:string|null; speechDisabled?:boolean }) {
  const isBuddy = message.role === "buddy";
  const Icon = isBuddy ? Bot : UserRound;

  return (
    <div className={cn("flex gap-3", !isBuddy && "justify-end")}>
      {isBuddy ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--landing-primary)] text-[var(--landing-inverse)] shadow-[0_8px_20px_rgba(30,53,34,0.14)]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      ) : null}
      <div
        className={cn(
          "max-w-[82%] rounded-[1.35rem] px-4 py-3 text-sm leading-6 shadow-[0_8px_24px_rgba(30,53,34,0.055)] sm:px-5 sm:py-4",
          isBuddy
            ? "rounded-tl-md border border-[var(--landing-primary-10)] bg-[var(--landing-cream-95)] text-[var(--landing-ink)]"
            : "rounded-tr-md bg-[var(--landing-sage-soft)] text-[var(--landing-ink)]",
        )}
      >
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--landing-primary)]">{isBuddy ? "Buddy" : "You"}</p>
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {isBuddy && !message.isStreaming && !message.isError && onReadAloud && <button type="button" onClick={onReadAloud} disabled={speechDisabled} aria-label={speechState==='preparing'?'Cancel preparing this reply':speechState==='playing'?'Stop reading this reply':speechError?'Retry reading this reply':'Read this reply aloud'} className="mt-2 inline-flex h-9 items-center gap-2 rounded-full px-2 text-xs text-[var(--landing-primary)] focus-visible:ring-2 focus-visible:ring-current disabled:opacity-50">
          {speechState==='preparing'?<LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true"/>:speechState==='playing'?<Square className="h-4 w-4" aria-hidden="true"/>:<Volume2 className="h-4 w-4" aria-hidden="true"/>}
          {speechState==='preparing'?'Preparing…':speechState==='playing'?'Stop':speechError?'Retry':'Read aloud'}
        </button>}
        {speechError && <p role="alert" className="mt-1 text-xs">{speechError}</p>}
        {message.playbackInterrupted && <p className="mt-1 text-xs opacity-75">Playback interrupted; the full reply is shown above.</p>}
        {message.generation ? <p className="mt-2 break-words text-[11px] text-[var(--landing-primary)]">{message.generation.executionState === "DEMO_FALLBACK" ? "Guided Support | DEMO_FALLBACK: prewritten support; no LLM or therapy" : message.generation.executionMode==="synthetic" ? "SYNTHETIC E2E FIXTURE — no trained generation" : `Experimental ${message.generation.modelId} @ ${message.generation.modelVersion} — not professional therapy`}</p> : null}
        <p className="mt-2 text-[11px] font-medium text-[var(--landing-primary)]">{message.timestamp}</p>
      </div>
    </div>
  );
}
