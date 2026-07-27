"use client";
import { useState, useEffect } from "react";

const DRAFT_KEY = "journal-draft";

interface JournalDraftManagerProps {
  onLoadDraft: (draft: { title: string; body: string }) => void;
  children: (props: { saveDraft: (title: string, body: string) => void; clearDraft: () => void; hasDraft: boolean }) => React.ReactNode;
}

export function JournalDraftManager({ onLoadDraft, children }: JournalDraftManagerProps) {
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        onLoadDraft(draft);
        setHasDraft(true);
      } catch { /* ignore */ }
    }
  }, [onLoadDraft]);

  function saveDraft(title: string, body: string) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, body }));
    setHasDraft(true);
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
  }

  return <>{children({ saveDraft, clearDraft, hasDraft })}</>;
}
