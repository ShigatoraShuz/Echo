"use client";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { getInsightsService } from "../services/insights-service.factory";
import type { InsightTimeRange, EmotionInsightSummary, JournalSourceBreakdown, RiskSignal, FacialTrendPoint } from "../model/insights.model";
import type { TrendPoint } from "@/types";

interface InsightsState {
  timeRange: InsightTimeRange;
  emotionSummary: EmotionInsightSummary | null;
  journalBreakdown: JournalSourceBreakdown[];
  riskSignal: RiskSignal | null;
  facialTrend: FacialTrendPoint[];
  riskTrend: TrendPoint[];
  isLoading: boolean;
  error: string | null;
}

type InsightsAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; summary: EmotionInsightSummary; breakdown: JournalSourceBreakdown[]; risk: RiskSignal; facialTrend: FacialTrendPoint[]; riskTrend: TrendPoint[] }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "SET_TIME_RANGE"; range: InsightTimeRange };

const initialState: InsightsState = {
  timeRange: "30d",
  emotionSummary: null,
  journalBreakdown: [],
  riskSignal: null,
  facialTrend: [],
  riskTrend: [],
  isLoading: true,
  error: null,
};

function reducer(state: InsightsState, action: InsightsAction): InsightsState {
  switch (action.type) {
    case "LOAD_START": return { ...state, isLoading: true, error: null };
    case "LOAD_SUCCESS": return { ...state, emotionSummary: action.summary, journalBreakdown: action.breakdown, riskSignal: action.risk, facialTrend: action.facialTrend, riskTrend: action.riskTrend, isLoading: false };
    case "LOAD_ERROR": return { ...state, error: action.error, isLoading: false };
    case "SET_TIME_RANGE": return { ...state, timeRange: action.range };
    default: return state;
  }
}

export function useInsightsViewModel() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const service = getInsightsService();
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (timeRange: InsightTimeRange) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    dispatch({ type: "LOAD_START" });
    const [summaryResult, breakdownResult, riskResult, facialResult] = await Promise.all([
      service.getEmotionSummary(timeRange, abortRef.current.signal),
      service.getJournalBreakdown(timeRange, abortRef.current.signal),
      service.getRiskSignal(abortRef.current.signal),
      service.getFacialTrend(abortRef.current.signal),
    ]);
    if (!summaryResult.success) {
      dispatch({ type: "LOAD_ERROR", error: summaryResult.error.message });
      return;
    }
    // The remaining insights are optional: the backend may not implement them
    // yet, in which case the emotion summary still renders.
    const riskTrend: TrendPoint[] = riskResult.success
      ? riskResult.data.history.map((point) => ({
          label: point.date,
          value: point.score,
          band: point.band,
        }))
      : [];
    dispatch({
      type: "LOAD_SUCCESS",
      summary: summaryResult.data,
      breakdown: breakdownResult.success ? breakdownResult.data : [],
      risk: riskResult.success
        ? riskResult.data
        : { score: 0, band: "low", label: "Unavailable", history: [], supportingFactors: [] },
      facialTrend: facialResult.success ? facialResult.data.points : [],
      riskTrend,
    });
  }, [service]);

  const setTimeRange = useCallback((range: InsightTimeRange) => {
    dispatch({ type: "SET_TIME_RANGE", range });
    load(range);
  }, [load]);

  useEffect(() => { load(state.timeRange); }, [load, state.timeRange]);

  return { ...state, setTimeRange, retry: () => load(state.timeRange) };
}