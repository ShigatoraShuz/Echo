"use client";
import { MessageSquarePlus, Sparkles } from "lucide-react";
import { PROMPT_CHIPS } from "../model/buddy.constants";

interface BuddyEmptyStateProps {
  onPromptSelect?: (prompt: string) => void;
  onNewConversation?: () => void;
}

export function BuddyEmptyState({ onPromptSelect, onNewConversation }: BuddyEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
        <MessageSquarePlus className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-foreground">Start a conversation</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Buddy is here to listen. Name what feels present, and take it one breath at a time.
      </p>
      {onPromptSelect && (
        <div className="mt-6">
          <p className="mb-3 flex items-center justify-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Gentle ways to begin
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {PROMPT_CHIPS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onPromptSelect(prompt)}
                className="rounded-full border border-primary/15 bg-background px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
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
