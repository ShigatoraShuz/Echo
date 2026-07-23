"use client";
import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface BuddyInputProps {
  onSend: (content: string) => void;
  isSending: boolean;
  placeholder?: string;
}

export function BuddyInput({ onSend, isSending, placeholder = "Tell Buddy what feels present..." }: BuddyInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isSending && textareaRef.current) textareaRef.current.focus();
  }, [isSending]);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || isSending) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex items-end gap-3 rounded-[1.4rem] border border-border bg-card/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        className="min-h-12 flex-1 resize-none bg-transparent px-1 py-1 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground"
        placeholder={placeholder}
        aria-label="Message Buddy"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!value.trim() || isSending}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none transition-all hover:bg-primary/90 hover:shadow-md focus-visible:ring-4 focus-visible:ring-primary/25 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45"
        aria-label="Send message"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
