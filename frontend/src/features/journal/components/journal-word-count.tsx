"use client";

interface WordCountProps {
  text: string;
}

export function JournalWordCount({ text }: WordCountProps) {
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  return (
    <p className="text-xs text-muted-foreground">
      {wordCount} {wordCount === 1 ? "word" : "words"} &middot; {charCount} {charCount === 1 ? "character" : "characters"}
    </p>
  );
}
