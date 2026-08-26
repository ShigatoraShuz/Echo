export type AnalysisSeverity = "minimal" | "mild" | "moderate" | "moderately_severe" | "severe";

export type AnalysisProviderName = "mock" | "ai-service";

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
  provider: AnalysisProviderName;
  modelVersion: string;
  processingTimeMs: number;
}

export interface AnalysisProviderHealth {
  status: "ok";
  provider: AnalysisProviderName;
}

export interface AnalysisProvider {
  analyze(input: AnalysisProviderInput): Promise<AnalysisProviderResult>;
  healthCheck(): Promise<AnalysisProviderHealth>;
  getProviderInfo(): { provider: AnalysisProviderName; version: string; developmentOnly: boolean };
}
