"use client";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { getGroundingService } from "@/services/grounding/grounding-service.factory";
import type { ExerciseType, PaceType } from "../model/grounding.model";

export type GroundingTechnique = "5-4-3-2-1" | "window-reset" | "box-breathing";
export type GroundingPace = "gentle" | "slower" | "steady";

interface GroundingState {
  technique: GroundingTechnique;
  pace: GroundingPace;
  durationMinutes: number;
  remainingSeconds: number;
  isRunning: boolean;
  isSaving: boolean;
  completedSessions: number | null;
  status: string | null;
}

type GroundingAction =
  | { type: "SET_TECHNIQUE"; technique: GroundingTechnique; remainingSeconds: number }
  | { type: "SET_PACE"; pace: GroundingPace }
  | { type: "SET_DURATION"; durationMinutes: number; remainingSeconds: number }
  | { type: "TOGGLE_RUNNING" }
  | { type: "RESET"; remainingSeconds: number }
  | { type: "TICK" }
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS"; completedSessions: number }
  | { type: "SAVE_ERROR"; message: string };

const TECHNIQUE_TO_EXERCISE: Record<GroundingTechnique, ExerciseType> = {
  "5-4-3-2-1": "sensory-5-4-3-2-1",
  "window-reset": "breathing-circle",
  "box-breathing": "box-breathing",
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
  status: null,
};

function reducer(state: GroundingState, action: GroundingAction): GroundingState {
  switch (action.type) {
    case "SET_TECHNIQUE": return { ...state, technique: action.technique, remainingSeconds: action.remainingSeconds, isRunning: false, status: null };
    case "SET_PACE": return { ...state, pace: action.pace };
    case "SET_DURATION": return { ...state, durationMinutes: action.durationMinutes, remainingSeconds: action.remainingSeconds, isRunning: false, status: null };
    case "TOGGLE_RUNNING": return { ...state, isRunning: !state.isRunning };
    case "RESET": return { ...state, isRunning: false, remainingSeconds: action.remainingSeconds, status: null };
    case "TICK": return { ...state, remainingSeconds: Math.max(0, state.remainingSeconds - 1) };
    case "SAVE_START": return { ...state, isSaving: true, status: "Saving your completed practice…" };
    case "SAVE_SUCCESS": return { ...state, isSaving: false, completedSessions: action.completedSessions, status: "Practice complete. Take a moment before moving on." };
    case "SAVE_ERROR": return { ...state, isSaving: false, status: action.message };
    default: return state;
  }
}

export function useGroundingViewModel() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const service = getGroundingService();
  const completedRef = useRef(false);

  const totalSeconds = state.durationMinutes * 60;

  useEffect(() => {
    if (!state.isRunning) return;
    const timer = window.setInterval(() => dispatch({ type: "TICK" }), 1_000);
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
          dispatch({ type: "SAVE_SUCCESS", completedSessions: (state.completedSessions ?? 0) + 1 });
        } else {
          dispatch({ type: "SAVE_ERROR", message: result.error.message });
          completedRef.current = false;
        }
      });
  }, [state.remainingSeconds, state.technique, state.durationMinutes, state.pace, state.completedSessions, service]);

  const toggleRunning = useCallback(() => {
    if (state.remainingSeconds === 0 || state.isSaving) return;
    dispatch({ type: "TOGGLE_RUNNING" });
  }, [state.remainingSeconds, state.isSaving]);

  const reset = useCallback(() => {
    completedRef.current = false;
    dispatch({ type: "RESET", remainingSeconds: state.durationMinutes * 60 });
  }, [state.durationMinutes]);

  const selectTechnique = useCallback((technique: GroundingTechnique) => {
    dispatch({ type: "SET_TECHNIQUE", technique, remainingSeconds: state.durationMinutes * 60 });
  }, [state.durationMinutes]);

  const selectDuration = useCallback((durationMinutes: number) => {
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
  };
}