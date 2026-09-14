"use client";
import { MessageSquarePlus, Sparkles } from "lucide-react";
import { PROMPT_CHIPS } from "../model/buddy.constants";

interface BuddyEmptyStateProps {
  onPromptSelect?: (prompt: string) => void;
  onNewConversation?: () => void;
}

export function BuddyEmptyState({ onPromptSelect, onNewConversation }: BuddyEmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center px-3 py-10 text-center sm:py-14">
      <span className="grid h-20 w-20 place-items-center rounded-[2rem] border border-primary/15 bg-secondary/60 text-primary shadow-[0_0_0_12px_hsl(var(--secondary)/0.3)]">
        <MessageSquarePlus className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-7 font-[family-name:var(--font-echo-display)] text-3xl font-medium text-foreground">Start with one sentence.</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Buddy is here to listen. Name what feels present, and take it one breath at a time.
      </p>
      {onPromptSelect && (
        <div className="mt-6">
          <p className="mb-3 flex items-center justify-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Gentle ways to begin
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PROMPT_CHIPS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onPromptSelect(prompt)}
                className="min-h-12 rounded-2xl border border-primary/15 bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-secondary/60 focus-visible:outline-primary"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}
      {onNewConversation && (
        <button
          type="button"
          onClick={onNewConversation}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          <MessageSquarePlus className="h-4 w-4" /> New conversation
        </button>
      )}
    </div>
  );
}
