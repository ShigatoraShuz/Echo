"use client";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { getGroundingService } from "@/services/grounding/grounding-service.factory";
import type { ExerciseType, GroundingSession, PaceType } from "../model/grounding.model";

export type GroundingTechnique = Exclude<ExerciseType, "breathing-circle">;
export type GroundingPace = "gentle" | "slower" | "steady";

interface GroundingState {
  technique: GroundingTechnique;
  pace: GroundingPace;
  durationMinutes: number;
  remainingSeconds: number;
  isRunning: boolean;
  isSaving: boolean;
  completedSessions: number | null;
  history: GroundingSession[] | null;
  historyError: string | null;
  status: string | null;
}

type GroundingAction =
  | { type: "SET_TECHNIQUE"; technique: GroundingTechnique; remainingSeconds: number }
  | { type: "SET_PACE"; pace: GroundingPace }
  | { type: "SET_DURATION"; durationMinutes: number; remainingSeconds: number }
  | { type: "START_PRACTICE"; technique: GroundingTechnique; durationMinutes: number }
  | { type: "TOGGLE_RUNNING" }
  | { type: "RESET"; remainingSeconds: number }
  | { type: "TICK"; remainingSeconds: number }
  | { type: "HISTORY_SUCCESS"; history: GroundingSession[] }
  | { type: "HISTORY_ERROR"; message: string }
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS"; session: GroundingSession }
  | { type: "SAVE_ERROR"; message: string };

const TECHNIQUE_TO_EXERCISE: Record<GroundingTechnique, ExerciseType> = {
  "sensory-5-4-3-2-1": "sensory-5-4-3-2-1",
  "window-reset": "window-reset",
  "box-breathing": "box-breathing",
  "progressive-muscle-relaxation": "progressive-muscle-relaxation",
  "positive-self-talk": "positive-self-talk",
  "body-scan": "body-scan",
  "guided-visualization": "guided-visualization",
  "gratitude-reflection": "gratitude-reflection",
  "4-7-8-breathing": "4-7-8-breathing",
};

const PACE_TO_PACE: Record<GroundingPace, PaceType> = {
  gentle: "slow",
  slower: "medium",
  steady: "fast",
};

const initialState: GroundingState = {
  technique: "box-breathing",
  pace: "gentle",
  durationMinutes: 2,
  remainingSeconds: 120,
  isRunning: false,
  isSaving: false,
  completedSessions: null,
  history: null,
  historyError: null,
  status: null,
};

function reducer(state: GroundingState, action: GroundingAction): GroundingState {
  switch (action.type) {
    case "SET_TECHNIQUE": return { ...state, technique: action.technique, remainingSeconds: action.remainingSeconds, isRunning: false, status: null };
    case "SET_PACE": return { ...state, pace: action.pace };
    case "SET_DURATION": return { ...state, durationMinutes: action.durationMinutes, remainingSeconds: action.remainingSeconds, isRunning: false, status: null };
    case "START_PRACTICE": return { ...state, technique: action.technique, durationMinutes: action.durationMinutes, remainingSeconds: action.durationMinutes * 60, isRunning: true, status: null };
    case "TOGGLE_RUNNING": return { ...state, isRunning: !state.isRunning };
    case "RESET": return { ...state, isRunning: false, remainingSeconds: action.remainingSeconds, status: null };
    case "TICK": return { ...state, remainingSeconds: Math.max(0, action.remainingSeconds), isRunning: action.remainingSeconds > 0 };
    case "HISTORY_SUCCESS": return { ...state, history: action.history, historyError: null, completedSessions: action.history.length };
    case "HISTORY_ERROR": return { ...state, history: [], historyError: action.message };
    case "SAVE_START": return { ...state, isSaving: true, status: "Saving your completed practice…" };
    case "SAVE_SUCCESS": return { ...state, isSaving: false, completedSessions: (state.completedSessions ?? 0) + 1, history: [action.session, ...(state.history ?? [])], status: "Practice complete. Take a moment before moving on." };
    case "SAVE_ERROR": return { ...state, isSaving: false, status: action.message };
    default: return state;
  }
}

export function useGroundingViewModel() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const service = getGroundingService();
  const completedRef = useRef(false);
  const deadlineRef = useRef(0);

  const totalSeconds = state.durationMinutes * 60;

  useEffect(() => {
    let active = true;
    void service.getHistory(250).then((result) => {
      if (!active) return;
      dispatch(result.success
        ? { type: "HISTORY_SUCCESS", history: result.data }
        : { type: "HISTORY_ERROR", message: result.error.message });
    });
    return () => { active = false; };
  }, [service]);

  useEffect(() => {
    if (!state.isRunning) return;
    const timer = window.setInterval(() => dispatch({ type: "TICK", remainingSeconds: Math.ceil((deadlineRef.current - Date.now()) / 1_000) }), 250);
    return () => window.clearInterval(timer);
  }, [state.isRunning]);

  useEffect(() => {
    if (state.remainingSeconds !== 0 || completedRef.current) return;
    completedRef.current = true;
    dispatch({ type: "SAVE_START" });
    void service
      .saveSession({
        type: TECHNIQUE_TO_EXERCISE[state.technique],
        duration: state.durationMinutes * 60,
        pace: PACE_TO_PACE[state.pace],
        completedAt: new Date().toISOString(),
      })
      .then((result) => {
        if (result.success) {
          dispatch({ type: "SAVE_SUCCESS", session: result.data });
        } else {
          dispatch({ type: "SAVE_ERROR", message: result.error.message });
          completedRef.current = false;
        }
      });
  }, [state.remainingSeconds, state.technique, state.durationMinutes, state.pace, service]);

  const toggleRunning = useCallback(() => {
    if (state.remainingSeconds === 0 || state.isSaving) return;
    if (state.isRunning) {
      const remainingSeconds = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1_000));
      dispatch({ type: "TICK", remainingSeconds });
      if (remainingSeconds === 0) return;
    } else {
      deadlineRef.current = Date.now() + state.remainingSeconds * 1_000;
    }
    dispatch({ type: "TOGGLE_RUNNING" });
  }, [state.remainingSeconds, state.isSaving, state.isRunning]);

  const startPractice = useCallback((technique: GroundingTechnique, durationMinutes: number) => {
    completedRef.current = false;
    deadlineRef.current = Date.now() + durationMinutes * 60_000;
    dispatch({ type: "START_PRACTICE", technique, durationMinutes });
  }, []);

  const reset = useCallback(() => {
    completedRef.current = false;
    dispatch({ type: "RESET", remainingSeconds: state.durationMinutes * 60 });
  }, [state.durationMinutes]);

  const selectTechnique = useCallback((technique: GroundingTechnique) => {
    completedRef.current = false;
    dispatch({ type: "SET_TECHNIQUE", technique, remainingSeconds: state.durationMinutes * 60 });
  }, [state.durationMinutes]);

  const selectDuration = useCallback((durationMinutes: number) => {
    completedRef.current = false;
    dispatch({ type: "SET_DURATION", durationMinutes, remainingSeconds: durationMinutes * 60 });
  }, []);

  const selectPace = useCallback((pace: GroundingPace) => {
    dispatch({ type: "SET_PACE", pace });
  }, []);

  return {
    ...state,
    totalSeconds,
    toggleRunning,
    reset,
    selectTechnique,
    selectDuration,
    selectPace,
    startPractice,
  };
}
