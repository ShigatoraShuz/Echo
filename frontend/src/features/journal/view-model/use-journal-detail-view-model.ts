"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { JournalEntry, JournalAnalysis } from "../model/journal.model";
import type { JournalAnalysisAvailability } from "@echo/contracts";
import { getJournalService } from "@/services/journal/journal-service.factory";

interface DetailState {
  analysisAvailability: JournalAnalysisAvailability | null;
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
  | { type: "CLEAR" }
  | { type: "ANALYSIS_ERROR"; error: string }
  | { type: "ANALYSIS_AVAILABILITY"; value: JournalAnalysisAvailability | null }
  | { type: "ENTRY_LOAD_START"; background: boolean }
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
    case "CLEAR": return { ...initialState, isLoading: false };
    case "ANALYSIS_ERROR": return { ...state, error: action.error, analysis: null, analysisAvailability: null };
    case "ANALYSIS_AVAILABILITY": return { ...state, analysisAvailability: action.value };
    case "ENTRY_LOAD_START":
      if (action.background) return { ...state, error: null };
      return { ...state, isLoading: true, error: null, notFound: false, analysis: null, analysisAvailability: null };
    case "ENTRY_LOAD_SUCCESS":
      return { ...state, isLoading: false, entry: action.entry,
        ...(!action.entry.analysisConsent ? { analysis: null, analysisAvailability: null } : {}) };
    case "ENTRY_LOAD_ERROR":
      return { ...state, isLoading: false, entry: null, analysis: null, analysisAvailability: null, error: action.error, notFound: action.notFound };
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
      return { ...state, isLoading: true, error: null, notFound: false, analysis: null, analysisAvailability: null };
    default:
      return state;
  }
}

const initialState: DetailState = {
  analysisAvailability: null,
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
  const [photoUploadError, setPhotoUploadError] = useState("");
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const service = getJournalService();
  const lastLoadedAt = useRef(0);
  const active = useRef(true);
  const entryReads = useRef(new Map<string, ReturnType<typeof service.getEntry>>());
  const entryReadService = useRef(service);
  const loadEpoch = useRef(0);
  const invalidateLoads = useCallback(() => { ++loadEpoch.current; }, []);

  const loadEntry = useCallback(
    async (entryId: string, background = false) => {
      if (!active.current) return;
      const epoch = ++loadEpoch.current;
      dispatch({ type: "ENTRY_LOAD_START", background });
      if (entryReadService.current !== service) { entryReads.current.clear(); entryReadService.current = service; }
      let read = entryReads.current.get(entryId);
      if (!read) {
        read = service.getEntry(entryId);
        entryReads.current.set(entryId, read);
        const created = read;
        void read.finally(() => { if (entryReads.current.get(entryId) === created) entryReads.current.delete(entryId); }).catch(() => {});
      }
      const result = await read;
      if (epoch !== loadEpoch.current) return;
      if (result.success) {
        lastLoadedAt.current = Date.now();
        dispatch({ type: "ENTRY_LOAD_SUCCESS", entry: result.data });

        if (result.data.analysisConsent) {
          const analysisResult = await service.getAnalysis(entryId);
          if (epoch !== loadEpoch.current) return;
          if (analysisResult.success) {
            dispatch({ type: "ANALYSIS_LOAD_SUCCESS", analysis: analysisResult.data });
            if (!analysisResult.data && service.getAnalysisAvailability) {
              const availability = await service.getAnalysisAvailability(entryId);
              if (epoch !== loadEpoch.current) return;
              if (availability.success) dispatch({ type: "ANALYSIS_AVAILABILITY", value: availability.data });
              else dispatch({ type: "ANALYSIS_ERROR", error: availability.error.message });
            }
          } else dispatch({ type: "ANALYSIS_ERROR", error: analysisResult.error.message });
        }
      } else {
        dispatch({
          type: "ENTRY_LOAD_ERROR",
          error: result.error.message,
          notFound: result.error.code === "NOT_FOUND",
        });
      }
    },
    [service],
  );

  useEffect(() => {
    active.current = true;
    const clear = () => { active.current = false; entryReads.current.clear(); invalidateLoads(); dispatch({ type: "CLEAR" }); };
    window.addEventListener("echo:sensitive-state-cleared", clear);
    if (id) loadEntry(id);
    else dispatch({ type: "CLEAR" });
    const refresh = (event: Event) => {
      const journalId = (event as CustomEvent<{ journalId?: string }>).detail?.journalId;
      if (id && (!journalId || journalId === id)) void loadEntry(id, true);
    };
    window.addEventListener("echo:analysis-completed", refresh);
    const refreshPhotos = () => {
      if (id && document.visibilityState === "visible" && Date.now() - lastLoadedAt.current > 4 * 60_000)
        void loadEntry(id, true);
    };
    document.addEventListener("visibilitychange", refreshPhotos);
    const interval = window.setInterval(refreshPhotos, 60_000);
    return () => {
      active.current = false;
      invalidateLoads();
      window.removeEventListener("echo:sensitive-state-cleared", clear);
      window.removeEventListener("echo:analysis-completed", refresh);
      document.removeEventListener("visibilitychange", refreshPhotos);
      window.clearInterval(interval);
    };
  }, [id, loadEntry, invalidateLoads]);

  const deleteEntry = useCallback(async () => {
    dispatch({ type: "DELETE_START" });
    const result = await service.deleteEntry(id);
    if (result.success) {
      dispatch({ type: "DELETE_SUCCESS" });
      window.dispatchEvent(new Event("echo:journal-changed"));
    } else {
      dispatch({ type: "DELETE_ERROR", error: result.error.message });
    }
    return result.success;
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
    loadEntry(id, Boolean(state.entry));
  }, [id, loadEntry, state.entry]);

  const addPhotos = useCallback(async (files: File[]) => {
    if (!files.length) return;
    if (
      files.length > 5 - (state.entry?.images?.length ?? 0) ||
      files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)
    ) {
      setPhotoUploadError("Choose up to five total JPEG, PNG, or WebP photos, at most 5 MB each.");
      return;
    }
    setPhotoUploadError("");
    setUploadingPhotos(true);
    try {
      for (const file of files) {
        const result = await service.uploadImage?.(id, crypto.randomUUID(), file);
        if (!result?.success) {
          setPhotoUploadError(result && !result.success ? result.error.message : "Photo upload is unavailable. Please retry.");
          break;
        }
      }
      retry();
    } catch {
      setPhotoUploadError("The photo could not be uploaded. Please retry.");
    } finally {
      setUploadingPhotos(false);
    }
  }, [id, retry, service, state.entry?.images?.length]);

  return {
    entry: state.entry,
    analysis: state.analysis,
    analysisAvailability: state.analysisAvailability,
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
    addPhotos,
    photoUploadError,
    uploadingPhotos,
  };
}
