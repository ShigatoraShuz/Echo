"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { DashboardInsights } from "@echo/contracts";
import { realAnalysisInsights } from "@/features/journal/model/real-analysis-insights";
import { getInsightsService } from "@/services/insights/insights-service.factory";
import { createInsightsMockAdapter } from "@/services/insights/insights.mock-adapter";
import type { InsightTimeRange } from "../model/insights.model";

interface InsightsState {
  timeRange: InsightTimeRange;
  customRange: { from: string; to: string } | null;
  overview: DashboardInsights | null;
  isLoading: boolean;
  error: string | null;
}

type InsightsAction =
  | { type: "CLEAR" }
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; overview: DashboardInsights }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "SET_RANGE"; range: InsightTimeRange; customRange?: { from: string; to: string } };

const initialState: InsightsState = {
  timeRange: "30d",
  customRange: null,
  overview: null,
  isLoading: true,
  error: null,
};
const previewService = createInsightsMockAdapter();

function reducer(state: InsightsState, action: InsightsAction): InsightsState {
  switch (action.type) {
    case "CLEAR": return { ...initialState, isLoading: false };
    case "LOAD_START":
      return { ...state, isLoading: true, error: null };
    case "LOAD_SUCCESS": {
      return {
        ...state,
        overview: action.overview,
        isLoading: false,
      };
    }
    case "LOAD_ERROR":
      return { ...state, error: action.error, isLoading: false };
    case "SET_RANGE":
      return { ...state, overview: null, timeRange: action.range, customRange: action.customRange ?? null };
  }
}

export function useInsightsViewModel(preview = false) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const service = preview && process.env.NODE_ENV !== "production" ? previewService : getInsightsService();
  const revision = useRef(0);
  const active = useRef(true);
  const pending = useRef(new Map<string, ReturnType<typeof service.getAnalysisOverview>>());

  const pendingService = useRef(service);

  useEffect(() => {
    active.current = true;
    const requests = pending.current;
    if (pendingService.current !== service) { requests.clear(); pendingService.current = service; }
    const sequence = revision;
    const clear = () => {
      active.current = false; ++sequence.current; requests.clear(); dispatch({ type: "CLEAR" });
    };
    window.addEventListener("echo:sensitive-state-cleared", clear);
    return () => {
      active.current = false; ++sequence.current;
      // Reuse unresolved reads during effect replay, never fulfilled private snapshots.
      window.removeEventListener("echo:sensitive-state-cleared", clear);
    };
  }, [service]);

  const load = useCallback(async (timeRange: InsightTimeRange, customRange?: { from: string; to: string }) => {
    if (!active.current) return;
    const epoch = ++revision.current;
    const key = `${timeRange}:${customRange?.from ?? ""}:${customRange?.to ?? ""}`;
    dispatch({ type: "LOAD_START" });
    try {
      let read = pending.current.get(key);
      if (!read) {
        read = service.getAnalysisOverview(timeRange, customRange);
        pending.current.set(key, read);
        const created = read;
        void read.finally(() => { if (pending.current.get(key) === created) pending.current.delete(key); }).catch(() => {});
      }
      const result = await read;
      if (!active.current || epoch !== revision.current) return;
      if (result.success) dispatch({ type: "LOAD_SUCCESS", overview: preview ? result.data : realAnalysisInsights(result.data)! });
      else dispatch({ type: "LOAD_ERROR", error: result.error.message });
    } catch {
      if (active.current && epoch === revision.current) dispatch({ type: "LOAD_ERROR", error: "Failed to load AI insights. Please retry." });
    }
  }, [service, preview]);

  useEffect(() => {
    void load(state.timeRange, state.customRange ?? undefined);
  }, [load, state.customRange, state.timeRange]);
  useEffect(() => {
    let disposed = false, queued = false;
    const refresh = () => {
      const key = `${state.timeRange}:${state.customRange?.from ?? ""}:${state.customRange?.to ?? ""}`;
      const read = pending.current.get(key);
      if (!read) { void load(state.timeRange, state.customRange ?? undefined); return; }
      if (queued) return;
      queued = true;
      void read.finally(() => { queued = false; if (!disposed && active.current) void load(state.timeRange, state.customRange ?? undefined); }).catch(() => {});
    };
    window.addEventListener("echo:analysis-completed", refresh);
    window.addEventListener("echo:journal-changed", refresh);
    return () => {
      disposed = true;
      window.removeEventListener("echo:analysis-completed", refresh);
      window.removeEventListener("echo:journal-changed", refresh);
    };
  }, [load, state.customRange, state.timeRange]);

  return {
    ...state,
    setTimeRange: (range: Exclude<InsightTimeRange, "custom">) => dispatch({ type: "SET_RANGE", range }),
    applyCustomRange: (from: string, to: string) =>
      dispatch({ type: "SET_RANGE", range: "custom", customRange: { from, to } }),
    retry: () => load(state.timeRange, state.customRange ?? undefined),
  };
}
