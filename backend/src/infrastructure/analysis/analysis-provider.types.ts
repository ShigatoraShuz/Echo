export type AnalysisSeverity = "minimal" | "mild" | "moderate" | "moderately_severe" | "severe";

export interface AnalysisProviderInput {
  requestId: string;
  journalText: string;
  language: string;
}

export interface AnalysisProviderResult {
  requestId: string;
  phq8Score: number;
  severity: AnalysisSeverity;
  urgentLanguageDetected: boolean;
  provider: "mock";
  modelVersion: "mock-analysis-v1";
  processingTimeMs: number;
}

export interface AnalysisProviderHealth {
  status: "ok";
  provider: "mock";
}

export interface AnalysisProvider {
  analyze(input: AnalysisProviderInput): Promise<AnalysisProviderResult>;
  healthCheck(): Promise<AnalysisProviderHealth>;
  getProviderInfo(): { provider: "mock"; version: "mock-analysis-v1"; developmentOnly: true };
}
