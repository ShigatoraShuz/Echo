export type ExerciseType = "sensory-5-4-3-2-1" | "box-breathing" | "breathing-circle";
export type PaceType = "slow" | "medium" | "fast";
export type TimerState = "idle" | "running" | "paused" | "completed";

export interface GroundingSession {
  id: string;
  type: ExerciseType;
  duration: number;
  pace: PaceType;
  completedAt: string;
  progress: number;
  state: TimerState;
}

export interface ExerciseStep {
  id: string;
  label: string;
  description: string;
  duration: number;
}
