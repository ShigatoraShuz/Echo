import { approvedOutboundUrl, postApprovedJson } from "../security/outbound-json.js";
import { randomUUID } from "node:crypto";
import { ExternalServiceError } from "../../shared/errors/app-error.js";
import { aiAnalysisResponseSchema, type AiAnalysisResponse } from "./ai.response.schema.js";
import { assertAiEnabled } from "../security/runtime-controls.js";

export interface AiClientOptions {
  baseUrl: string;
  allowedOrigins: readonly string[];
  token: string;
  timeoutMs: number;
}

export interface AnalyzeJournalInput {
  requestId?: string;
  journalText: string;
  language?: string;
}

export function createAiClient(options: AiClientOptions) {
  const endpoint = approvedOutboundUrl(`${options.baseUrl.replace(/\/$/, "")}/v1/analyze`, options.allowedOrigins);
  return {
    async analyzeJournal(input: AnalyzeJournalInput): Promise<AiAnalysisResponse> {
      await assertAiEnabled();
      const requestId = input.requestId ?? randomUUID();
      let output: unknown;
      try {
        if(input.journalText.length>40_000) throw new Error("Input limit exceeded");
        output = await postApprovedJson(endpoint, {
          Authorization: `Bearer ${options.token}`, "Content-Type":"application/json", "X-Request-Id":requestId,
        }, JSON.stringify({request_id:requestId,journal_text:input.journalText,language:input.language??"en"}), options.timeoutMs);
      } catch { throw new ExternalServiceError(); }
      const parsed = aiAnalysisResponseSchema.safeParse(output);
      if (!parsed.success || parsed.data.request_id !== requestId) {
        throw new ExternalServiceError("AI_RESPONSE_INVALID", "The analysis service returned an invalid response.");
      }

      return parsed.data;
    },
  };
}
