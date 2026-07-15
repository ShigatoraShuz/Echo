"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { JournalEntry, JournalSearchFilters, JournalPagination, JournalMood, JournalSortOption } from "../model/journal.model";
import { DefaultJournalFilters } from "../model/journal.model";
import { JOURNAL_PAGE_SIZE } from "../model/journal.constants";
import { getJournalService } from "../services/journal-service.factory";

interface ListState {
  entries: JournalEntry[];
  pagination: JournalPagination;
  filters: JournalSearchFilters;
  isLoading: boolean;
  error: string | null;
  searchInput: string;
}

type ListAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; entries: JournalEntry[]; pagination: JournalPagination }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "SET_FILTERS"; filters: Partial<JournalSearchFilters> }
  | { type: "SET_SEARCH"; searchInput: string }
  | { type: "SET_PAGE"; page: number }
  | { type: "DELETE_ENTRY"; id: string }
  | { type: "RESET_FILTERS" };

function reducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, isLoading: true, error: null };
    case "LOAD_SUCCESS":
      return { ...state, isLoading: false, entries: action.entries, pagination: action.pagination };
    case "LOAD_ERROR":
      return { ...state, isLoading: false, error: action.error };
    case "SET_FILTERS":
      return { ...state, filters: { ...state.filters, ...action.filters } };
    case "SET_SEARCH":
      return { ...state, searchInput: action.searchInput };
    case "SET_PAGE":
      return { ...state, pagination: { ...state.pagination, page: action.page } };
    case "DELETE_ENTRY":
      return { ...state, entries: state.entries.filter((e) => e.id !== action.id) };
    case "RESET_FILTERS":
      return { ...state, filters: DefaultJournalFilters, searchInput: "" };
    default:
      return state;
  }
}

const initialState: ListState = {
  entries: [],
  pagination: { page: 1, pageSize: JOURNAL_PAGE_SIZE, totalItems: 0, totalPages: 0 },
  filters: DefaultJournalFilters,
  isLoading: true,
  error: null,
  searchInput: "",
};

export function useJournalListViewModel() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const service = getJournalService();
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadEntries = useCallback(
    async (filters: JournalSearchFilters, page: number) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      dispatch({ type: "LOAD_START" });
      const result = await service.listEntries(filters, page, JOURNAL_PAGE_SIZE, controller.signal);
      if (controller.signal.aborted) return;
      if (result.success) {
        dispatch({ type: "LOAD_SUCCESS", entries: result.data.entries, pagination: result.data.pagination });
      } else {
        dispatch({ type: "LOAD_ERROR", error: result.error.message });
      }
    },
    [service]
  );

  useEffect(() => {
    loadEntries(state.filters, state.pagination.page);
  }, [state.filters, state.pagination.page, loadEntries]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const setFilters = useCallback(
    (partial: Partial<JournalSearchFilters>) => {
      dispatch({ type: "SET_FILTERS", filters: { ...partial, ...(partial.mood !== undefined ? { mood: partial.mood } : {}), ...(partial.sort !== undefined ? { sort: partial.sort } : {}) } });
    },
    []
  );

  const setSearch = useCallback((searchInput: string) => {
    dispatch({ type: "SET_SEARCH", searchInput });
  }, []);

  const applySearch = useCallback(() => {
    dispatch({ type: "SET_FILTERS", filters: { query: state.searchInput } });
  }, [state.searchInput]);

  const setPage = useCallback((page: number) => {
    dispatch({ type: "SET_PAGE", page });
  }, []);

  const setMoodFilter = useCallback((mood: JournalMood | null) => {
    dispatch({ type: "SET_FILTERS", filters: { mood } });
  }, []);

  const setSort = useCallback((sort: JournalSortOption) => {
    dispatch({ type: "SET_FILTERS", filters: { sort } });
  }, []);

  const deleteEntry = useCallback(
    async (id: string) => {
      const result = await service.deleteEntry(id);
      if (result.success) {
        dispatch({ type: "DELETE_ENTRY", id });
      }
    },
    [service]
  );

  const resetFilters = useCallback(() => {
    dispatch({ type: "RESET_FILTERS" });
  }, []);

  const retry = useCallback(() => {
    loadEntries(state.filters, state.pagination.page);
  }, [loadEntries, state.filters, state.pagination.page]);

  return {
    entries: state.entries,
    pagination: state.pagination,
    filters: state.filters,
    isLoading: state.isLoading,
    error: state.error,
    searchInput: state.searchInput,
    isFiltered: state.filters.query !== "" || state.filters.mood !== null || state.filters.dateFrom !== null || state.filters.dateTo !== null,
    setSearch,
    applySearch,
    setFilters,
    setMoodFilter,
    setSort,
    setPage,
    deleteEntry,
    resetFilters,
    retry,
  };
}
