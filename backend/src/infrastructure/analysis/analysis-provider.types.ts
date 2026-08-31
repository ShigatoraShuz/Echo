import type { AnalysisFixture, AnalysisStatus, JournalAnalysisResult } from "@echo/contracts";

export interface JournalAnalysisInput {
  requestId: string;
  journalId: string;
  journalText: string;
  fixture: AnalysisFixture;
  reviewedResume?: boolean;
}
export interface AnalysisProgressUpdate {
  status: Exclude<AnalysisStatus, "queued" | "waiting_for_provider" | "completed" | "failed" | "retrying">;
}
export interface AiProviderHealth {
  available: boolean;
  mode: "disabled" | "development_stub";
  detail: "disabled" | "development fixture runner ready";
}
export interface AiAnalysisProvider {
  healthCheck(): Promise<AiProviderHealth>;
  analyze(
    input: JournalAnalysisInput,
    options: {
      signal?: AbortSignal;
      onProgress?: (update: AnalysisProgressUpdate) => Promise<void> | void;
    },
  ): Promise<{ safetyActionRequired: boolean; result?: JournalAnalysisResult }>;
}
export interface LocalWorkerProtocol {
  protocolHealth(): Promise<unknown>;
  reportHealth(workerId: string, acceptingJobs: boolean, modelStatus?: string, modelVersion?: string): Promise<unknown>;
  claim(workerId: string): Promise<unknown>;
  heartbeat(jobId: string, workerId: string, leaseToken: string, key?: string): Promise<unknown>;
  progress(
    jobId: string,
    workerId: string,
    leaseToken: string,
    key: string | undefined,
    payload: unknown,
  ): Promise<unknown>;
  safetyResult(
    jobId: string,
    workerId: string,
    leaseToken: string,
    key: string | undefined,
    payload: unknown,
  ): Promise<unknown>;
  finalResult(
    jobId: string,
    workerId: string,
    leaseToken: string,
    key: string | undefined,
    payload: unknown,
  ): Promise<unknown>;
  failure(
    jobId: string,
    workerId: string,
    leaseToken: string,
    key: string | undefined,
    payload: unknown,
  ): Promise<unknown>;
}
