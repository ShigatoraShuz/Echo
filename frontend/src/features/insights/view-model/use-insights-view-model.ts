"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { DashboardInsights } from "@echo/contracts";
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
      return { ...state, timeRange: action.range, customRange: action.customRange ?? null };
  }
}

export function useInsightsViewModel(preview = false) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const service = preview ? previewService : getInsightsService();
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (timeRange: InsightTimeRange, customRange?: { from: string; to: string }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "LOAD_START" });
    const result = await service.getAnalysisOverview(timeRange, customRange, controller.signal);
    if (result.success) dispatch({ type: "LOAD_SUCCESS", overview: result.data });
    else if (!controller.signal.aborted) dispatch({ type: "LOAD_ERROR", error: result.error.message });
  }, [service]);

  useEffect(() => {
    void load(state.timeRange, state.customRange ?? undefined);
    return () => abortRef.current?.abort();
  }, [load, state.customRange, state.timeRange]);

  return {
    ...state,
    setTimeRange: (range: Exclude<InsightTimeRange, "custom">) => dispatch({ type: "SET_RANGE", range }),
    applyCustomRange: (from: string, to: string) =>
      dispatch({ type: "SET_RANGE", range: "custom", customRange: { from, to } }),
    retry: () => load(state.timeRange, state.customRange ?? undefined),
  };
}
