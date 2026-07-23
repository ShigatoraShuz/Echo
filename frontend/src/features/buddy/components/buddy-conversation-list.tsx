"use client";
import type { BuddyConversation } from "../../model/buddy.model";

interface ConversationListProps {
  conversations: BuddyConversation[];
  isLoading: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function BuddyConversationList({ conversations, isLoading, selectedId, onSelect }: ConversationListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-secondary/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          type="button"
          onClick={() => onSelect(conv.id)}
          className={w-full rounded-xl p-3 text-left transition-colors hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-primary }
        >
          <p className="truncate text-sm font-semibold text-foreground">{conv.title}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{conv.lastMessage}</p>
          <p className="mt-1 text-[10px] text-muted-foreground/70">{conv.lastMessageAt} · {conv.messageCount} messages</p>
        </button>
      ))}
    </div>
  );
}
