"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type {
  JournalMood,
  JournalPrivacyStatus,
  CreateJournalInput,
  JournalEntry,
  JournalDraft,
} from "../model/journal.model";
import { JOURNAL_AUTOSAVE_INTERVAL_MS } from "../model/journal.constants";
import { validateCreateJournalInput } from "../model/journal.schema";
import { getJournalService } from "@/services/journal/journal-service.factory";
import type { AnalysisFixture, FaceMeshCapture, JournalSubmissionResponse } from "@echo/contracts";
import { env } from "@/config/environment";

export type AutosaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

interface EditorState {
  title: string;
  body: string;
  mood: JournalMood;
  emotions: string[];
  tags: string[];
  privacyStatus: JournalPrivacyStatus;
  analysisConsent: boolean;
  wordCount: number;
  charCount: number;
  isSaving: boolean;
  autosaveStatus: AutosaveStatus;
  error: string | null;
  savedEntry: JournalEntry | null;
  analysisSubmission: JournalSubmissionResponse | null;
  fixture: AnalysisFixture;
  fieldErrors: Record<string, string[]>;
}

type EditorAction =
  | { type: "RESTORE_DRAFT"; draft: JournalDraft }
  | { type: "SET_FIELD"; field: "title" | "body" | "mood" | "privacyStatus"; value: string }
  | { type: "SET_EMOTIONS"; emotions: string[] }
  | { type: "SET_TAGS"; tags: string[] }
  | { type: "SET_ANALYSIS_CONSENT"; analysisConsent: boolean }
  | { type: "UPDATE_COUNTS" }
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS"; entry: JournalEntry }
  | { type: "ANALYSIS_SUBMITTED"; submission: JournalSubmissionResponse }
  | { type: "SET_FIXTURE"; fixture: AnalysisFixture }
  | { type: "SAVE_ERROR"; error: string }
  | { type: "SET_FIELD_ERRORS"; fieldErrors: Record<string, string[]> }
  | { type: "SET_AUTOSAVE_STATUS"; status: AutosaveStatus }
  | { type: "CLEAR_ERROR" }
  | { type: "RESET" };

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function hasContent(state: EditorState): boolean {
  return state.title.trim().length > 0 || state.body.trim().length > 0;
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "RESTORE_DRAFT":
      return { ...state, ...action.draft, wordCount: countWords(action.draft.body), charCount: action.draft.body.length, autosaveStatus: "saved" };
    case "SET_FIELD": {
      const next = { ...state, [action.field]: action.value };
      const bodyText = action.field === "body" ? action.value : state.body;
      next.wordCount = countWords(bodyText);
      next.charCount = bodyText.length;
      next.autosaveStatus = "unsaved";
      return next;
    }
    case "SET_EMOTIONS":
      return { ...state, emotions: action.emotions, autosaveStatus: "unsaved" };
    case "SET_TAGS":
      return { ...state, tags: action.tags, autosaveStatus: "unsaved" };
    case "SET_ANALYSIS_CONSENT":
      return { ...state, analysisConsent: action.analysisConsent, autosaveStatus: "unsaved" };
    case "UPDATE_COUNTS": {
      return { ...state, wordCount: countWords(state.body), charCount: state.body.length };
    }
    case "SAVE_START":
      return { ...state, isSaving: true, error: null, fieldErrors: {} };
    case "SAVE_SUCCESS":
      return { ...state, isSaving: false, autosaveStatus: "saved", savedEntry: action.entry };
    case "ANALYSIS_SUBMITTED":
      return { ...state, isSaving: false, autosaveStatus: "saved", analysisSubmission: action.submission };
    case "SET_FIXTURE":
      return { ...state, fixture: action.fixture, autosaveStatus: "unsaved" };
    case "SAVE_ERROR":
      return { ...state, isSaving: false, autosaveStatus: "error", error: action.error };
    case "SET_FIELD_ERRORS":
      return { ...state, fieldErrors: action.fieldErrors, isSaving: false };
    case "SET_AUTOSAVE_STATUS":
      return { ...state, autosaveStatus: action.status };
    case "CLEAR_ERROR":
      return { ...state, error: null, fieldErrors: {} };
    case "RESET":
      return { ...initialEditorState };
    default:
      return state;
  }
}

const initialEditorState: EditorState = {
  title: "",
  body: "",
  mood: "calm",
  emotions: [],
  tags: [],
  privacyStatus: "private",
  analysisConsent: false,
  wordCount: 0,
  charCount: 0,
  isSaving: false,
  autosaveStatus: "idle",
  error: null,
  savedEntry: null,
  analysisSubmission: null,
  fixture: "standard_low_distress",
  fieldErrors: {},
};

export function useJournalEditorViewModel() {
  const [state, dispatch] = useReducer(reducer, initialEditorState);
  const service = getJournalService();
  const [draftReady, setDraftReady] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isAutosavingRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const restored = useRef(false);
  const edited = useRef(false);
  const submitting = useRef(false);
  const finalized = useRef(false);
  const accepted = useRef<Awaited<ReturnType<typeof service.createEntry>> | null>(null);
  const autosaveInFlight = useRef<Promise<unknown> | null>(null);
  const revision = useRef(0);

  useEffect(() => {
    let active = true;
    void service.getDraft?.("current").then(result => {
      if (!active) return;
      if (result.success && result.data && !edited.current) {
        idempotencyKeyRef.current = result.data.submissionKey ?? crypto.randomUUID();
        dispatch({ type: "RESTORE_DRAFT", draft: result.data });
      } else if (!result.success) dispatch({ type: "SAVE_ERROR", error: result.error.message });
      restored.current = result.success;
      setDraftReady(result.success);
    }).catch(() => { if (active) dispatch({ type: "SAVE_ERROR", error: "Your saved draft could not be loaded. Please reload before editing." }); });
    if (!service.getDraft) { restored.current = true; setDraftReady(true); }
    return () => { active = false; };
  }, [service]);

  const requestChanged = useCallback(() => {
    if (!restored.current || submitting.current || accepted.current?.success) return false;
    edited.current = true;
    revision.current += 1;
    idempotencyKeyRef.current = null;
    return true;
  }, []);

  const setField = useCallback(
    (field: "title" | "body" | "mood" | "privacyStatus", value: string) => {
      if (!requestChanged()) return;
      dispatch({ type: "SET_FIELD", field, value });
    },
    [requestChanged],
  );

  const setTitle = useCallback((title: string) => setField("title", title), [setField]);
  const setBody = useCallback((body: string) => setField("body", body), [setField]);
  const setMood = useCallback((mood: JournalMood) => setField("mood", mood), [setField]);
  const setPrivacyStatus = useCallback(
    (privacyStatus: JournalPrivacyStatus) => setField("privacyStatus", privacyStatus),
    [setField],
  );
  const setEmotions = useCallback(
    (emotions: string[]) => {
      if (!requestChanged()) return;
      dispatch({ type: "SET_EMOTIONS", emotions });
    },
    [requestChanged],
  );
  const setTags = useCallback(
    (tags: string[]) => {
      if (!requestChanged()) return;
      dispatch({ type: "SET_TAGS", tags });
    },
    [requestChanged],
  );
  const setAnalysisConsent = useCallback(
    (analysisConsent: boolean) => {
      if (!requestChanged()) return;
      dispatch({ type: "SET_ANALYSIS_CONSENT", analysisConsent });
    },
    [requestChanged],
  );
  const setFixture = useCallback(
    (fixture: AnalysisFixture) => {
      if (!requestChanged()) return;
      dispatch({ type: "SET_FIXTURE", fixture });
    },
    [requestChanged],
  );

  const performAutosave = useCallback(async () => {
    if (isAutosavingRef.current || finalized.current || accepted.current?.success || !restored.current) return;
    const savingRevision = revision.current;
    isAutosavingRef.current = true;
    dispatch({ type: "SET_AUTOSAVE_STATUS", status: "saving" });

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const draft: JournalDraft = {
        submissionKey: idempotencyKeyRef.current ??= crypto.randomUUID(),
        id: state.savedEntry?.id ?? `draft-${Date.now()}`,
        title: state.title.trim(),
        body: state.body.trim(),
        mood: state.mood,
        emotions: state.emotions,
        tags: state.tags,
        privacyStatus: state.privacyStatus,
        analysisConsent: state.analysisConsent,
        updatedAt: new Date().toISOString().split("T")[0],
      };

      const operation = service.saveDraft(draft);
      autosaveInFlight.current = operation;
      const result = await operation;
      if (result.success) {
        dispatch({ type: "SET_AUTOSAVE_STATUS", status: savingRevision === revision.current ? "saved" : "unsaved" });
      } else {
        dispatch({ type: "SET_AUTOSAVE_STATUS", status: "error" });
        dispatch({ type: "SAVE_ERROR", error: result.error.message });
      }
    } catch {
      dispatch({ type: "SET_AUTOSAVE_STATUS", status: "error" });
    } finally {
      isAutosavingRef.current = false;
      autosaveInFlight.current = null;
      abortControllerRef.current = null;
    }
  }, [
    state.title,
    state.body,
    state.mood,
    state.emotions,
    state.tags,
    state.privacyStatus,
    state.analysisConsent,
    state.savedEntry?.id,
    service,
  ]);

  // Debounced autosave
  useEffect(() => {
    if (state.isSaving || state.savedEntry || state.analysisSubmission || finalized.current) return;
    if (!state.title.trim() && !state.body.trim()) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      if (!submitting.current && !finalized.current) void performAutosave();
    }, JOURNAL_AUTOSAVE_INTERVAL_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [state.title, state.body, state.mood, state.tags, state.privacyStatus, state.analysisConsent, state.isSaving, state.savedEntry, state.analysisSubmission, performAutosave]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (hasContent(state) && !finalized.current && (state.autosaveStatus !== "saved" || state.isSaving)) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  // Cancel on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const save = useCallback(async (facial?: { requested: boolean; capture?: FaceMeshCapture }, photos: Array<{id:string;file:File}> = []) => {
    if (submitting.current || finalized.current) return;
    if (!restored.current) { dispatch({type:"SAVE_ERROR",error:"Please wait for your saved draft to load before submitting."}); return; }
    const input: Record<string, unknown> = {
      title: state.title,
      body: state.body,
      mood: state.mood,
      privacyStatus: state.privacyStatus,
    };
    const validation = validateCreateJournalInput(input);
    if (!validation.valid) {
      dispatch({ type: "SET_FIELD_ERRORS", fieldErrors: validation.errors });
      return;
    }

    submitting.current = true;
    try {
    dispatch({ type: "SAVE_START" });
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    await autosaveInFlight.current;
    const createInput: CreateJournalInput = {
      title: state.title.trim(),
      body: state.body.trim(),
      mood: state.mood,
      emotions: state.emotions,
      tags: state.tags,
      privacyStatus: state.privacyStatus,
      analysisConsent: state.analysisConsent,
      facialAnalysisRequested: state.analysisConsent && facial?.requested === true,
      ...(state.analysisConsent && facial?.capture ? { facialCapture: facial.capture } : {}),
    };
    idempotencyKeyRef.current ??= crypto.randomUUID();
    // Save the retry identity before submission so reopening a failed draft replays safely.
    const draftResult = await service.saveDraft({ id: "current", ...createInput, submissionKey: idempotencyKeyRef.current, updatedAt: new Date().toISOString() });
    if (!draftResult.success) { submitting.current=false; dispatch({type:"SAVE_ERROR",error:draftResult.error.message}); return; }
    const result = accepted.current ?? await service.createEntry(createInput, {
      idempotencyKey: idempotencyKeyRef.current,
      ...(env.enableAnalysisFixtures && state.analysisConsent ? { fixture: state.fixture } : {}),
    });
    if (result.success) {
      accepted.current = result;
      const data = result.data;
      const journalId = "kind" in data && data.kind === "analysis" ? data.submission.journalId : (data as JournalEntry).id;
      for (const photo of photos) {
        const uploaded = await service.uploadImage?.(journalId,photo.id,photo.file);
        if (!uploaded?.success) {
          dispatch({type:"SAVE_ERROR",error:uploaded && !uploaded.success ? uploaded.error.message : "Your journal was saved, but photo upload is unavailable. Keep this page open to retry."});
          return;
        }
      }
      const cleared = await service.deleteDraft(idempotencyKeyRef.current);
      if (!cleared.success) { dispatch({type:"SAVE_ERROR",error:"Your journal was saved. Draft cleanup could not finish; retry to finalize without creating another journal."}); return; }
      finalized.current = true;
      if ("kind" in data && data.kind === "analysis") {
        dispatch({ type: "ANALYSIS_SUBMITTED", submission: data.submission });
        try { localStorage.setItem("echo:active-analysis", JSON.stringify(data.submission)); } catch { /* Backend notifications retain discovery if browser storage is unavailable. */ }
        window.dispatchEvent(new CustomEvent("echo:analysis-submitted", { detail: data.submission }));
      } else {
        dispatch({ type: "SAVE_SUCCESS", entry: data as JournalEntry });
      }
    } else {
      dispatch({ type: "SAVE_ERROR", error: result.error.message });
    }
    } catch {
      dispatch({type:"SAVE_ERROR",error:"The save could not be confirmed. Your draft and retry information are preserved; please retry."});
    } finally { submitting.current = false; }
  }, [
    state.title,
    state.body,
    state.mood,
    state.emotions,
    state.tags,
    state.privacyStatus,
    state.analysisConsent,
    state.fixture,
    service,
  ]);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  const reset = useCallback(() => {
    idempotencyKeyRef.current = null;
    dispatch({ type: "RESET" });
  }, []);

  const retryAutosave = useCallback(() => {
    if (hasContent(state)) {
      performAutosave();
    }
  }, [state, performAutosave]);

  return {
    draftReady,
    title: state.title,
    body: state.body,
    mood: state.mood,
    emotions: state.emotions,
    tags: state.tags,
    privacyStatus: state.privacyStatus,
    analysisConsent: state.analysisConsent,
    wordCount: state.wordCount,
    charCount: state.charCount,
    isSaving: state.isSaving,
    autosaveStatus: state.autosaveStatus,
    error: state.error,
    fieldErrors: state.fieldErrors,
    savedEntry: state.savedEntry,
    analysisSubmission: state.analysisSubmission,
    fixture: state.fixture,
    setTitle,
    setBody,
    setMood,
    setEmotions,
    setTags,
    setPrivacyStatus,
    setAnalysisConsent,
    setFixture,
    save,
    clearError,
    reset,
    retryAutosave,
  };
}
