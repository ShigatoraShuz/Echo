"use client";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { getInsightsService } from "@/services/insights/insights-service.factory";
import type { InsightTimeRange, EmotionInsightSummary } from "../model/insights.model";

interface InsightsState {
  timeRange: InsightTimeRange;
  emotionSummary: EmotionInsightSummary | null;
  isLoading: boolean;
  error: string | null;
}

type InsightsAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; summary: EmotionInsightSummary }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "SET_TIME_RANGE"; range: InsightTimeRange };

const initialState: InsightsState = {
  timeRange: "30d",
  emotionSummary: null,
  isLoading: true,
  error: null,
};

function reducer(state: InsightsState, action: InsightsAction): InsightsState {
  switch (action.type) {
    case "LOAD_START": return { ...state, isLoading: true, error: null };
    case "LOAD_SUCCESS": return { ...state, emotionSummary: action.summary, isLoading: false };
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
    const summaryResult = await service.getEmotionSummary(timeRange, abortRef.current.signal);
    if (!summaryResult.success) {
      dispatch({ type: "LOAD_ERROR", error: summaryResult.error.message });
      return;
    }
    dispatch({
      type: "LOAD_SUCCESS",
      summary: summaryResult.data,
    });
  }, [service]);

  const setTimeRange = useCallback((range: InsightTimeRange) => {
    dispatch({ type: "SET_TIME_RANGE", range });
  }, []);

  useEffect(() => { load(state.timeRange); }, [load, state.timeRange]);

  return { ...state, setTimeRange, retry: () => load(state.timeRange) };
}
