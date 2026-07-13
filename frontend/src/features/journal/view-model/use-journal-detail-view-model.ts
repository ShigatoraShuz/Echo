"use client";

import { useCallback, useEffect, useReducer } from "react";
import type { JournalEntry, JournalAnalysis } from "../model/journal.model";
import { getJournalService } from "../services/journal-service.factory";

interface DetailState {
  entry: JournalEntry | null;
  analysis: JournalAnalysis | null;
  isLoading: boolean;
  isDeleting: boolean;
  isExporting: boolean;
  showDeleteDialog: boolean;
  error: string | null;
  notFound: boolean;
}

type DetailAction =
  | { type: "ENTRY_LOAD_START" }
  | { type: "ENTRY_LOAD_SUCCESS"; entry: JournalEntry }
  | { type: "ENTRY_LOAD_ERROR"; error: string; notFound: boolean }
  | { type: "ANALYSIS_LOAD_SUCCESS"; analysis: JournalAnalysis | null }
  | { type: "DELETE_START" }
  | { type: "DELETE_SUCCESS" }
  | { type: "DELETE_ERROR"; error: string }
  | { type: "EXPORT_START" }
  | { type: "EXPORT_SUCCESS" }
  | { type: "EXPORT_ERROR"; error: string }
  | { type: "SHOW_DELETE_DIALOG"; show: boolean }
  | { type: "RETRY"; id: string };

function reducer(state: DetailState, action: DetailAction): DetailState {
  switch (action.type) {
    case "ENTRY_LOAD_START":
      return { ...state, isLoading: true, error: null, notFound: false };
    case "ENTRY_LOAD_SUCCESS":
      return { ...state, isLoading: false, entry: action.entry };
    case "ENTRY_LOAD_ERROR":
      return { ...state, isLoading: false, error: action.error, notFound: action.notFound };
    case "ANALYSIS_LOAD_SUCCESS":
      return { ...state, analysis: action.analysis };
    case "DELETE_START":
      return { ...state, isDeleting: true };
    case "DELETE_SUCCESS":
      return { ...state, isDeleting: false, showDeleteDialog: false };
    case "DELETE_ERROR":
      return { ...state, isDeleting: false, error: action.error };
    case "EXPORT_START":
      return { ...state, isExporting: true };
    case "EXPORT_SUCCESS":
      return { ...state, isExporting: false };
    case "EXPORT_ERROR":
      return { ...state, isExporting: false, error: action.error };
    case "SHOW_DELETE_DIALOG":
      return { ...state, showDeleteDialog: action.show, error: null };
    case "RETRY":
      return { ...state, isLoading: true, error: null, notFound: false };
    default:
      return state;
  }
}

const initialState: DetailState = {
  entry: null,
  analysis: null,
  isLoading: true,
  isDeleting: false,
  isExporting: false,
  showDeleteDialog: false,
  error: null,
  notFound: false,
};

export function useJournalDetailViewModel(id: string) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const service = getJournalService();

  const loadEntry = useCallback(
    async (entryId: string) => {
      dispatch({ type: "ENTRY_LOAD_START" });
      const result = await service.getEntry(entryId);
      if (result.success) {
        dispatch({ type: "ENTRY_LOAD_SUCCESS", entry: result.data });

        if (result.data.analysisConsent) {
          const analysisResult = await service.getAnalysis(entryId);
          if (analysisResult.success) {
            dispatch({ type: "ANALYSIS_LOAD_SUCCESS", analysis: analysisResult.data });
          }
        }
      } else {
        dispatch({ type: "ENTRY_LOAD_ERROR", error: result.error.message, notFound: result.error.code === "NOT_FOUND" });
      }
    },
    [service]
  );

  useEffect(() => {
    if (id) loadEntry(id);
  }, [id, loadEntry]);

  const deleteEntry = useCallback(async () => {
    dispatch({ type: "DELETE_START" });
    const result = await service.deleteEntry(id);
    if (result.success) {
      dispatch({ type: "DELETE_SUCCESS" });
    } else {
      dispatch({ type: "DELETE_ERROR", error: result.error.message });
    }
  }, [id, service]);

  const exportEntry = useCallback(async () => {
    dispatch({ type: "EXPORT_START" });
    const result = await service.exportEntry(id);
    if (result.success) {
      const blob = new Blob([result.data.markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `journal-${id}.md`;
      a.click();
      URL.revokeObjectURL(url);
      dispatch({ type: "EXPORT_SUCCESS" });
    } else {
      dispatch({ type: "EXPORT_ERROR", error: result.error.message });
    }
  }, [id, service]);

  const showDeleteDialog = useCallback((show: boolean) => {
    dispatch({ type: "SHOW_DELETE_DIALOG", show });
  }, []);

  const retry = useCallback(() => {
    loadEntry(id);
  }, [id, loadEntry]);

  return {
    entry: state.entry,
    analysis: state.analysis,
    isLoading: state.isLoading,
    isDeleting: state.isDeleting,
    isExporting: state.isExporting,
    showDeleteDialog: state.showDeleteDialog,
    error: state.error,
    notFound: state.notFound,
    deleteEntry,
    exportEntry,
    openDeleteDialog: showDeleteDialog,
    retry,
  };
}
