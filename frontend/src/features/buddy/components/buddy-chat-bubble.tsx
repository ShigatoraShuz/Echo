"use client";
import { Bot, UserRound } from "lucide-react";
import type { BuddyMessage } from "../model/buddy.model";
import { cn } from "@/shared/lib/utils";

export function BuddyChatBubble({ message }: { message: BuddyMessage }) {
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
        {message.generation ? <p className="mt-2 break-words text-[11px] text-[var(--landing-primary)]">{message.generation.executionState === "DEMO_FALLBACK" ? "Guided Support | DEMO_FALLBACK: prewritten support; no LLM or therapy" : message.generation.executionMode==="synthetic" ? "SYNTHETIC E2E FIXTURE — no trained generation" : `Experimental ${message.generation.modelId} @ ${message.generation.modelVersion} — not professional therapy`}</p> : null}
        <p className="mt-2 text-[11px] font-medium text-[var(--landing-primary)]">{message.timestamp}</p>
      </div>
    </div>
  );
}
