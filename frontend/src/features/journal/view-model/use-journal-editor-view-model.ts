"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { JournalMood, JournalPrivacyStatus, CreateJournalInput, JournalEntry, JournalDraft } from "../model/journal.model";
import { JOURNAL_AUTOSAVE_INTERVAL_MS } from "../model/journal.constants";
import { validateCreateJournalInput } from "../model/journal.schema";
import { getJournalService } from "../services/journal-service.factory";

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
  fieldErrors: Record<string, string[]>;
}

type EditorAction =
  | { type: "SET_FIELD"; field: "title" | "body" | "mood" | "privacyStatus"; value: string }
  | { type: "SET_EMOTIONS"; emotions: string[] }
  | { type: "SET_TAGS"; tags: string[] }
  | { type: "SET_ANALYSIS_CONSENT"; analysisConsent: boolean }
  | { type: "UPDATE_COUNTS" }
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS"; entry: JournalEntry }
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
  fieldErrors: {},
};

export function useJournalEditorViewModel() {
  const [state, dispatch] = useReducer(reducer, initialEditorState);
  const service = getJournalService();
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isAutosavingRef = useRef(false);

  const setField = useCallback((field: "title" | "body" | "mood" | "privacyStatus", value: string) => {
    dispatch({ type: "SET_FIELD", field, value });
  }, []);

  const setTitle = useCallback((title: string) => setField("title", title), [setField]);
  const setBody = useCallback((body: string) => setField("body", body), [setField]);
  const setMood = useCallback((mood: JournalMood) => setField("mood", mood), [setField]);
  const setPrivacyStatus = useCallback((privacyStatus: JournalPrivacyStatus) => setField("privacyStatus", privacyStatus), [setField]);
  const setEmotions = useCallback((emotions: string[]) => dispatch({ type: "SET_EMOTIONS", emotions }), []);
  const setTags = useCallback((tags: string[]) => dispatch({ type: "SET_TAGS", tags }), []);
  const setAnalysisConsent = useCallback((analysisConsent: boolean) => dispatch({ type: "SET_ANALYSIS_CONSENT", analysisConsent }), []);

  const performAutosave = useCallback(async () => {
    if (isAutosavingRef.current) return;
    isAutosavingRef.current = true;
    dispatch({ type: "SET_AUTOSAVE_STATUS", status: "saving" });

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const draft: JournalDraft = {
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

      const result = await service.saveDraft(draft);
      if (result.success) {
        dispatch({ type: "SET_AUTOSAVE_STATUS", status: "saved" });
      } else {
        dispatch({ type: "SET_AUTOSAVE_STATUS", status: "error" });
        dispatch({ type: "SAVE_ERROR", error: result.error.message });
      }
    } catch {
      dispatch({ type: "SET_AUTOSAVE_STATUS", status: "error" });
    } finally {
      isAutosavingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [state.title, state.body, state.mood, state.emotions, state.tags, state.privacyStatus, state.analysisConsent, state.savedEntry?.id, service]);

  // Debounced autosave
  useEffect(() => {
    if (!state.title.trim() && !state.body.trim()) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      performAutosave();
    }, JOURNAL_AUTOSAVE_INTERVAL_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [state.title, state.body, state.mood, state.tags, state.privacyStatus, state.analysisConsent, performAutosave]);

  // Cancel on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const save = useCallback(async () => {
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

    dispatch({ type: "SAVE_START" });
    const createInput: CreateJournalInput = {
      title: state.title.trim(),
      body: state.body.trim(),
      mood: state.mood,
      emotions: state.emotions,
      tags: state.tags,
      privacyStatus: state.privacyStatus,
      analysisConsent: state.analysisConsent,
    };
    const result = await service.createEntry(createInput);
    if (result.success) {
      dispatch({ type: "SAVE_SUCCESS", entry: result.data });
    } else {
      dispatch({ type: "SAVE_ERROR", error: result.error.message });
    }
  }, [state.title, state.body, state.mood, state.emotions, state.tags, state.privacyStatus, state.analysisConsent, service]);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const retryAutosave = useCallback(() => {
    if (hasContent(state)) {
      performAutosave();
    }
  }, [state, performAutosave]);

  return {
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
    setTitle,
    setBody,
    setMood,
    setEmotions,
    setTags,
    setPrivacyStatus,
    setAnalysisConsent,
    save,
    clearError,
    reset,
    retryAutosave,
  };
}
