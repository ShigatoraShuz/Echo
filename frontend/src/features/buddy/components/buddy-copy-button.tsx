"use client";
import { useState, useCallback } from "react";
import { Check, Clipboard } from "lucide-react";

export function useCopyToClipboard() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = useCallback(async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  return { copiedId, copy };
}

interface CopyButtonProps {
  messageId: string;
  content: string;
  copiedId: string | null;
  onCopy: (id: string, content: string) => void;
}

export function BuddyCopyButton({ messageId, content, copiedId, onCopy }: CopyButtonProps) {
  const isCopied = copiedId === messageId;
  return (
    <button
      type="button"
      onClick={() => onCopy(messageId, content)}
      className="rounded-full p-1 text-muted-foreground hover:bg-secondary/60"
      aria-label={isCopied ? "Copied" : "Copy message"}
    >
      {isCopied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Clipboard className="h-3.5 w-3.5" />}
    </button>
  );
}
