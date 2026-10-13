"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { DashboardInsights } from "@echo/contracts";
import { getInsightsService } from "@/services/insights/insights-service.factory";
import { createInsightsMockAdapter } from "@/services/insights/insights.mock-adapter";
import type { InsightTimeRange, RiskSignal } from "../model/insights.model";
import type { TrendPoint } from "@/shared/types";

interface InsightsState {
  timeRange: InsightTimeRange;
  customRange: { from: string; to: string } | null;
  overview: DashboardInsights | null;
  riskSignal: RiskSignal | null;
  riskTrend: TrendPoint[];
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
  riskSignal: null,
  riskTrend: [],
  isLoading: true,
  error: null,
};
const previewService = createInsightsMockAdapter();

function reducer(state: InsightsState, action: InsightsAction): InsightsState {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, isLoading: true, error: null };
    case "LOAD_SUCCESS": {
      const latest = action.overview.latest;
      const score = latest
        ? Math.round((["low", "mild", "moderate", "high", "severe"].indexOf(latest.distressBand) / 4) * 100)
        : 0;
      return {
        ...state,
        overview: action.overview,
        riskSignal: latest
          ? {
              score,
              band: latest.distressBand,
              label: `${latest.distressBand} signal`,
              history: action.overview.distressTrend.map((point) => ({
                date: point.date,
                score: Math.round(point.value * 100),
                band: point.band,
              })),
              supportingFactors: [],
            }
          : null,
        riskTrend: action.overview.distressTrend.map((point) => ({
          label: point.date,
          value: Math.round(point.value * 100),
          band: point.band,
        })),
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
