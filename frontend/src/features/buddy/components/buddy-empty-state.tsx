"use client";
import { MessageSquarePlus, Sparkles, Leaf, Wind, BookOpen, ArrowUpRight } from "lucide-react";
import styles from "../view/buddy-studio.module.css";
import { PROMPT_CHIPS } from "../model/buddy.constants";

interface BuddyEmptyStateProps {
  onPromptSelect?: (prompt: string) => void;
  onNewConversation?: () => void;
}
const promptLabels = ["Untangle", "Find your calm", "Look inward", "Move forward"];
const promptIcons = [Sparkles, Wind, BookOpen, Leaf];

export function BuddyEmptyState({ onPromptSelect, onNewConversation }: BuddyEmptyStateProps) {
  return (
    <div className={styles.welcome}>
      <div className={styles.welcomeHero}>
        <div className={styles.welcomeCopy}>
          <p className={styles.eyebrow}><span /> Your private reflection studio</p>
          <h2 className={styles.welcomeTitle}>Room to think.<em>Space to bloom.</em></h2>
          <p className={styles.welcomeDescription}>Bring the thoughts you haven’t quite found words for. We can explore them, one small step at a time.</p>
          <span className={styles.paceNote}><Leaf size={13} aria-hidden="true" /> Your pace. Your words. Your space.</span>
        </div>
        <div className={styles.bloom} aria-hidden="true">
          <span className={styles.bloomHalo} />
          <span className={styles.petal} /><span className={styles.petal} /><span className={styles.petal} /><span className={styles.petal} /><span className={styles.petal} />
          <span className={styles.bloomCore}><Leaf size={42} strokeWidth={1.1} /></span>
          <Sparkles className={styles.bloomSpark} size={22} />
          <span className={styles.bloomCaption}>A LITTLE ROOM TO GROW</span>
        </div>
      </div>
      {onPromptSelect && (
        <div className={styles.starters}>
          <div className={styles.startersHeading}><p>Where would you like to begin?</p><span>Choose a starting point</span></div>
          <div className={styles.promptGrid}>
            {PROMPT_CHIPS.map((prompt, index) => {
              const Icon = promptIcons[index];
              return (
                <button key={prompt} type="button" aria-label={prompt} onClick={() => onPromptSelect(prompt)}
                  className={styles.promptCard} style={{ animationDelay: `${160 + index * 75}ms` }}>
                  <span className={styles.promptCardTop}><span className={styles.promptIcon}><Icon size={18} aria-hidden="true" /></span><ArrowUpRight size={15} className={styles.promptArrow} aria-hidden="true" /></span>
                  <span className={styles.promptLabel}>{promptLabels[index]}</span>
                  <span className={styles.promptDescription}>{prompt}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {onNewConversation && <button type="button" onClick={onNewConversation} className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"><MessageSquarePlus className="h-4 w-4" aria-hidden="true" />New conversation</button>}
    </div>
  );
}
