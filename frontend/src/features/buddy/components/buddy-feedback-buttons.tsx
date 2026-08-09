"use client";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface FeedbackButtonsProps {
  messageId: string;
  currentFeedback: "positive" | "negative" | null;
  onFeedback: (messageId: string, feedback: "positive" | "negative") => void;
}

export function BuddyFeedbackButtons({ messageId, currentFeedback, onFeedback }: FeedbackButtonsProps) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => onFeedback(messageId, "positive")}
        className={`rounded-full p-1 transition-colors ${currentFeedback === "positive" ? "bg-primary text-primary-foreground" : ""} hover:bg-secondary/60`}
        aria-label="Mark as helpful"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onFeedback(messageId, "negative")}
        className={`rounded-full p-1 transition-colors ${currentFeedback === "negative" ? "bg-primary text-primary-foreground" : ""} hover:bg-secondary/60`}
        aria-label="Mark as not helpful"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
