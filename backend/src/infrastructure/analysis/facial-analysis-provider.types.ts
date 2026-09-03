import type { FaceMeshCapture, FacialAnalysisStatus } from "@echo/contracts";

export interface FacialAnalysisSubmission {
  userId: string;
  journalId: string;
  analysisJobId: string;
  capture?: FaceMeshCapture;
}

export interface FacialAnalysisProvider {
  submit(input: FacialAnalysisSubmission): Promise<FacialAnalysisStatus>;
}

/** Current production-safe boundary. It never invents an emotion result. */
export class DisabledFacialAnalysisProvider implements FacialAnalysisProvider {
  async submit(input: FacialAnalysisSubmission): Promise<FacialAnalysisStatus> {
    return input.capture ? "captured_pending_provider" : "not_captured";
  }
}
