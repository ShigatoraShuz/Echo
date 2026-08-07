import { randomUUID } from "node:crypto";
import { ExternalServiceError } from "../../shared/errors/app-error.js";
import { aiAnalysisResponseSchema, type AiAnalysisResponse } from "./ai.response.schema.js";

export interface AiClientOptions {
  baseUrl: string;
  token: string;
  timeoutMs: number;
}

export interface AnalyzeJournalInput {
  requestId?: string;
  journalText: string;
  language?: string;
}

export function createAiClient(options: AiClientOptions) {
  return {
    async analyzeJournal(input: AnalyzeJournalInput): Promise<AiAnalysisResponse> {
      const requestId = input.requestId ?? randomUUID();
      let response: Response;

      try {
        response = await fetch(`${options.baseUrl.replace(/\/$/, "")}/v1/analyze`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.token}`,
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
          body: JSON.stringify({
            request_id: requestId,
            journal_text: input.journalText,
            language: input.language ?? "en",
          }),
          signal: AbortSignal.timeout(options.timeoutMs),
        });
      } catch {
        throw new ExternalServiceError();
      }

      if (!response.ok) throw new ExternalServiceError();
      const parsed = aiAnalysisResponseSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success || parsed.data.request_id !== requestId) {
        throw new ExternalServiceError("AI_RESPONSE_INVALID", "The analysis service returned an invalid response.");
      }

      return parsed.data;
    },
  };
}
