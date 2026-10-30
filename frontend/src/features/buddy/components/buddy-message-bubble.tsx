"use client";
import { Bot, UserRound, Clipboard, RotateCcw, ThumbsUp, ThumbsDown } from "lucide-react";
import type { BuddyMessage } from "../model/buddy.model";
import { cn } from "@/shared/lib/utils";
import { useState } from "react";

interface MessageBubbleProps {
  message: BuddyMessage;
  onRetry?: (messageId: string) => void;
  onCopy?: (content: string) => void;
  onFeedback?: (messageId: string, feedback: "positive" | "negative") => void;
}

export function BuddyMessageBubble({ message, onRetry, onCopy, onFeedback }: MessageBubbleProps) {
  const isBuddy = message.role === "buddy";
  const Icon = isBuddy ? Bot : UserRound;
  const [showActions, setShowActions] = useState(false);

  return (
    <div className={cn("flex gap-3 group", !isBuddy && "justify-end")}>
      {isBuddy && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-subtle">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[82%] rounded-[1.35rem] px-4 py-3 text-sm leading-6 shadow-subtle sm:px-5 sm:py-4",
          isBuddy
            ? "rounded-tl-md border border-border bg-card text-foreground"
            : "rounded-tr-md bg-primary text-primary-foreground",
          message.isError && "border-danger/30 bg-danger/5"
        )}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <p>{message.content}</p>
        {message.generation ? <p className="mt-2 break-words text-[11px] text-current">{message.generation.executionState === "DEMO_FALLBACK" ? "Guided Support | DEMO_FALLBACK: prewritten support; no LLM or therapy" : message.generation.executionMode==="synthetic" ? "SYNTHETIC E2E FIXTURE — no trained generation" : `Experimental ${message.generation.modelId} @ ${message.generation.modelVersion} — not professional therapy`}</p> : null}
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[11px] font-medium text-current">{message.timestamp}</p>
          {showActions && isBuddy && (
            <div className="flex gap-1">
              {onCopy && (
                <button type="button" onClick={() => onCopy(message.id)} className="rounded-full p-1 text-muted-foreground hover:bg-secondary/60" aria-label="Copy message">
                  <Clipboard className="h-3.5 w-3.5" />
                </button>
              )}
              {onFeedback && (
                <>
<button type="button" onClick={() => onFeedback(message.id, "positive")} className={`rounded-full p-1 transition-colors ${message.feedback === "positive" ? "bg-primary text-primary-foreground" : ""} hover:bg-secondary/60`} aria-label="Helpful">
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
<button type="button" onClick={() => onFeedback(message.id, "negative")} className={`rounded-full p-1 transition-colors ${message.feedback === "negative" ? "bg-primary text-primary-foreground" : ""} hover:bg-secondary/60`} aria-label="Not helpful">
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {message.isError && onRetry && (
          <button type="button" onClick={() => onRetry(message.id)} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-danger hover:text-danger/80">
            <RotateCcw className="h-3 w-3" /> Retry
          </button>
        )}
      </div>
    </div>
  );
}
