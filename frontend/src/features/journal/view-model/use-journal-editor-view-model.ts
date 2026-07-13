"use client";

import { useCallback, useEffect, useReducer } from "react";
import type { JournalMood, JournalPrivacyStatus, CreateJournalInput, JournalEntry } from "../model/journal.model";
import { JOURNAL_AUTOSAVE_INTERVAL_MS } from "../model/journal.constants";
import { validateCreateJournalInput } from "../model/journal.schema";
import { getJournalService } from "../services/journal-service.factory";

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
  isAutosaving: boolean;
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
  | { type: "AUTOSAVE_START" }
  | { type: "SAVE_SUCCESS"; entry: JournalEntry }
  | { type: "SAVE_ERROR"; error: string }
  | { type: "SET_FIELD_ERRORS"; fieldErrors: Record<string, string[]> }
  | { type: "CLEAR_ERROR" }
  | { type: "RESET" };

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_FIELD": {
      const next = { ...state, [action.field]: action.value };
      const bodyText = action.field === "body" ? action.value : state.body;
      next.wordCount = countWords(bodyText);
      next.charCount = bodyText.length;
      return next;
    }
    case "SET_EMOTIONS":
      return { ...state, emotions: action.emotions };
    case "SET_TAGS":
      return { ...state, tags: action.tags };
    case "SET_ANALYSIS_CONSENT":
      return { ...state, analysisConsent: action.analysisConsent };
    case "UPDATE_COUNTS": {
      return { ...state, wordCount: countWords(state.body), charCount: state.body.length };
    }
    case "SAVE_START":
      return { ...state, isSaving: true, error: null, fieldErrors: {} };
    case "AUTOSAVE_START":
      return { ...state, isAutosaving: true, error: null };
    case "SAVE_SUCCESS":
      return { ...state, isSaving: false, isAutosaving: false, savedEntry: action.entry };
    case "SAVE_ERROR":
      return { ...state, isSaving: false, isAutosaving: false, error: action.error };
    case "SET_FIELD_ERRORS":
      return { ...state, fieldErrors: action.fieldErrors, isSaving: false };
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
  isAutosaving: false,
  error: null,
  savedEntry: null,
  fieldErrors: {},
};

export function useJournalEditorViewModel() {
  const [state, dispatch] = useReducer(reducer, initialEditorState);
  const service = getJournalService();

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

  // Autosave
  useEffect(() => {
    if (!state.title && !state.body) return;
    const timer = setInterval(async () => {
      dispatch({ type: "AUTOSAVE_START" });
      // In mock mode, autosave is a no-op that just shows status
      dispatch({ type: "SAVE_SUCCESS", entry: state.savedEntry! });
    }, JOURNAL_AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.title, state.body, service]);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

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
    isAutosaving: state.isAutosaving,
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
  };
}
