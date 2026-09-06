"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { JournalMood, JournalPrivacyStatus, JournalEntry, JournalDraft } from "../model/journal.model";
import { validateCreateJournalInput } from "../model/journal.schema";
import { getJournalService } from "@/services/journal/journal-service.factory";
import { journalMedia, type JournalAttachment } from "@/services/journal/journal-media";
export type AutosaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";
const empty: JournalDraft = {
  id: "",
  title: "",
  body: "",
  mood: "calm",
  emotions: [],
  tags: [],
  privacyStatus: "private",
  analysisConsent: false,
  updatedAt: "",
};
export function useJournalEditorViewModel() {
  const [draft, setDraft] = useState(empty);
  const [ready, setReady] = useState(false);
  const [isSaving, setBusy] = useState(false);
  const [autosaveStatus, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [savedEntry, setSaved] = useState<JournalEntry | null>(null);
  const [attachments, setAttachments] = useState<JournalAttachment[]>([]);
  const lock = useRef(false);
  const pendingFinalization = useRef<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const service = getJournalService();
  useEffect(() => {
    let active = true;
    void service
      .getDraft("current")
      .then(async (result) => {
        if (!active) return;
        if (!result.success) {
          setError(result.error.message);
          return;
        }
        if (result.data) {
          setDraft(result.data);
          try {
            const media = await journalMedia.list(result.data.id, true);
            if (active) setAttachments(media);
          } catch {
            if (active) setError("Draft text loaded, but image previews are unavailable. Reload to retry.");
          }
        }
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setError("Your draft could not be loaded. Reload to retry before editing.");
      });
    return () => {
      active = false;
    };
  }, [service]);
  const change = useCallback(<K extends keyof JournalDraft>(key: K, value: JournalDraft[K]) => {
    if (lock.current || pendingFinalization.current) return;
    setDraft((d) => ({ ...d, [key]: value }));
    setStatus("unsaved");
  }, []);
  async function persist() {
    const result = await service.saveDraft({ ...draft, updatedAt: new Date().toISOString() });
    if (!result.success) throw new Error(result.error.message);
    setDraft((d) => ({ ...d, id: result.data.id }));
    setStatus("saved");
    return result.data;
  }
  async function run(action: () => Promise<void>) {
    if (lock.current || !ready || savedEntry) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setStatus("saving");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your changes could not be saved.");
      setStatus("error");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function saveDraft() {
    if (pendingFinalization.current) return;
    await run(async () => {
      await persist();
    });
  }
  async function save() {
    const validation = validateCreateJournalInput({ ...draft });
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      return;
    }
    await run(async () => {
      const draftId = pendingFinalization.current ?? (await persist()).id;
      pendingFinalization.current = draftId;
      setFinalizing(true);
      setSaved(await journalMedia.finalize(draftId));
      setFinalizing(false);
      setStatus("saved");
    });
  }
  async function upload(file: File) {
    if (pendingFinalization.current) return;
    await run(async () => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5242880 || !file.size)
        throw new Error("Choose a JPEG, PNG, or WebP image up to 5 MB.");
      const current = await persist();
      setAttachments(await journalMedia.upload(current.id, file));
    });
  }
  async function removeAttachment(id: string) {
    if (pendingFinalization.current) return;
    await run(async () => {
      await journalMedia.remove(id);
      setAttachments((items) => items.filter((item) => item.id !== id));
      setStatus("saved");
    });
  }
  useEffect(() => {
    if (autosaveStatus !== "unsaved" && !finalizing) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [autosaveStatus, finalizing]);
  return {
    ...draft,
    ready,
    finalizing,
    isSaving,
    autosaveStatus,
    error,
    fieldErrors,
    savedEntry,
    attachments,
    wordCount: draft.body.trim() ? draft.body.trim().split(/\s+/).length : 0,
    charCount: draft.body.length,
    setTitle: (v: string) => change("title", v),
    setBody: (v: string) => change("body", v),
    setMood: (v: JournalMood) => change("mood", v),
    setTags: (v: string[]) => change("tags", v),
    setEmotions: (v: string[]) => change("emotions", v),
    setPrivacyStatus: (v: JournalPrivacyStatus) => change("privacyStatus", v),
    setAnalysisConsent: (v: boolean) => change("analysisConsent", v),
    save,
    saveDraft,
    upload,
    removeAttachment,
    clearError: () => setError(null),
  };
}
