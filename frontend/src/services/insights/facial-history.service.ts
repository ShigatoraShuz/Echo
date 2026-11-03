import { facialExpressionResultSchema, type FacialExpressionResult } from "@echo/contracts";
import { env } from "@/config/environment";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";

export interface FacialHistoryEntry {
  journalId: string;
  result: FacialExpressionResult;
}

export async function getFacialHistory(signal: AbortSignal): Promise<FacialHistoryEntry[]> {
  const token = await supabaseAuthTokenProvider.getAccessToken();
  const response = await fetch(env.apiBaseUrl + "/journals/facial-history", {
    headers: { Authorization: "Bearer " + token },
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Facial history is unavailable.");
  const body: { data: Array<{ journalId: string; result: unknown }> } = await response.json();
  return body.data.map((row) => ({
    journalId: row.journalId,
    result: facialExpressionResultSchema.parse(row.result),
  }));
}
