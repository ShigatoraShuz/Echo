import type { GroundingSession, ExerciseType, PaceType } from "@/features/grounding/model/grounding.model";

export type GroundingServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export interface GroundingService {
  saveSession(session: { type: ExerciseType; duration: number; pace: PaceType; completedAt: string }): Promise<GroundingServiceResult<GroundingSession>>;
}
