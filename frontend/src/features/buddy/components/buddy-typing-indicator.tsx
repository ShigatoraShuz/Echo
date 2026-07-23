"use client";

interface TypingIndicatorProps {
  label?: string;
}

export function BuddyTypingIndicator({ label = "Buddy is reflecting" }: TypingIndicatorProps) {
  return (
    <div className="flex items-center gap-3 pl-14" role="status" aria-live="polite">
      <div className="flex items-center gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}&hellip;</span>
    </div>
  );
}
