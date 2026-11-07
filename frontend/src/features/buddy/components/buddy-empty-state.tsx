"use client";
import { MessageSquarePlus, Sparkles, Leaf, Wind, BookOpen, ArrowUpRight } from "lucide-react";
import styles from "../view/buddy-studio.module.css";
import { PROMPT_CHIPS } from "../model/buddy.constants";

interface BuddyEmptyStateProps {
  onPromptSelect?: (prompt: string) => void;
  onNewConversation?: () => void;
}

export function BuddyEmptyState({ onPromptSelect, onNewConversation }: BuddyEmptyStateProps) {
  return (
    <div className={styles.welcome}>
      <div className={styles.bloom} aria-hidden="true">
        <span className={styles.petal} /><span className={styles.petal} /><span className={styles.petal} />
        <span className={styles.bloomCore}><Leaf size={34} strokeWidth={1.25} /></span>
        <Sparkles className={styles.bloomSpark} size={18} />
      </div>
      <p className={styles.eyebrow}>A moment, just for you</p>
      <h2 className={styles.welcomeTitle}>Let your thoughts unfold.</h2>
      <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
        Start with one sentence, a small question, or whatever is on your mind. There is no perfect way to begin.
      </p>
      {onPromptSelect && (
        <div className="mt-7 w-full">
          <p className="mb-3 flex items-center justify-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Gentle ways to begin
          </p>
          <div className={styles.promptGrid}>
            {PROMPT_CHIPS.map((prompt, index) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onPromptSelect(prompt)}
                className={styles.promptCard} style={{ animationDelay: `${120 + index * 65}ms` }}
              >
                <span className={styles.promptIcon}>{index === 1 ? <Wind size={17} /> : index === 2 ? <BookOpen size={17} /> : index === 3 ? <Leaf size={17} /> : <Sparkles size={17} />}</span>
                <span>{prompt}</span><ArrowUpRight size={14} className={styles.promptArrow} aria-hidden="true" />
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
