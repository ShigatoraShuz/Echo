"use client";
import { useEffect, useRef } from "react";
import type { BuddyMessage } from "../model/buddy.model";
import { BuddyMessageBubble } from "./buddy-message-bubble";
import { BuddyTypingIndicator } from "./buddy-typing-indicator";

interface MessageContainerProps {
  messages: BuddyMessage[];
  isStreaming?: boolean;
  streamingContent?: string;
  onRetry?: (messageId: string) => void;
  onCopy?: (content: string) => void;
  onFeedback?: (messageId: string, feedback: "positive" | "negative") => void;
}

export function BuddyMessageContainer({ messages, isStreaming, streamingContent, onRetry, onCopy, onFeedback }: MessageContainerProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, streamingContent]);

  return (
    <div className="min-h-[390px] space-y-5" aria-live="polite" aria-busy={isStreaming ?? false}>
      {messages.map((message) => (
        <BuddyMessageBubble
          key={message.id}
          message={message}
          onRetry={onRetry}
          onCopy={onCopy}
          onFeedback={onFeedback}
        />
      ))}
      {streamingContent && (
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-subtle">
            <span className="text-sm">B</span>
          </div>
          <div className="max-w-[82%] rounded-[1.35rem] rounded-tl-md border border-border bg-card px-5 py-4 text-sm leading-6 text-foreground shadow-subtle">
            <p>{streamingContent}</p>
            <span className="inline-block h-4 w-1 animate-pulse bg-primary/60 ml-1" />
          </div>
        </div>
      )}
      {isStreaming && !streamingContent && <BuddyTypingIndicator />}
      <div ref={endRef} />
    </div>
  );
}
