"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { facialExpressionResultSchema, type FacialExpressionResult } from "@echo/contracts";
import { env } from "@/config/environment";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import { Shield } from "lucide-react";
import { PrivacyNotice } from "@/shared/components/echo";
import { EchoCard, PageHeader } from "@/shared/components/layout";
import { VerifiedFeatureGate } from "@/features/verification";

export function FacialInsightsView() {
  const [history, setHistory] = useState<Array<{ journalId: string; result: FacialExpressionResult }>>([]),
    [state, setState] = useState("loading");
  useEffect(() => {
    const abort = new AbortController();
    void (async () => {
      try {
        const token = await supabaseAuthTokenProvider.getAccessToken();
        const response = await fetch(env.apiBaseUrl + "/journals/facial-history", {
          headers: { Authorization: "Bearer " + token },
          signal: abort.signal,
          cache: "no-store",
        });
        if (!response.ok) throw Error();
        const body = await response.json();
        const rows = body.data.map((x: { journalId: string; result: unknown }) => ({
          journalId: x.journalId,
          result: facialExpressionResultSchema.parse(x.result),
        }));
        if (!abort.signal.aborted) {
          setHistory(rows);
          setState("ready");
        }
      } catch {
        if (!abort.signal.aborted) setState("unavailable");
      }
    })();
    return () => abort.abort();
  }, []);
  return (
    <VerifiedFeatureGate featureName="Facial trend analysis">
      <div className="space-y-6">
        <PageHeader
          label="Insights"
          title="Local facial expressions"
          description="Facial capture is optional and starts only when you choose it for a reflection."
        />
        <EchoCard
          title="Experimental expression history"
          description="Visible expression estimates stay separate from text emotions and questionnaire scores."
        >
          {history.length > 0 ? (
            <ul className="mb-4 space-y-3">
              {history.map(
                (row) =>
                  row.result.status === "available" && (
                    <li key={row.journalId} className="rounded-xl border border-border p-3">
                      <Link href={"/journal/" + row.journalId} className="font-semibold underline">
                        {row.result.prediction}
                      </Link>
                      <p className="text-xs">
                        {new Date(row.result.generatedAt).toLocaleString()} � Development model; uncalibrated scores
                      </p>
                    </li>
                  ),
              )}
            </ul>
          ) : (
            <p role="status" className="mb-4 text-sm">
              {state === "loading"
                ? "Loading local results�"
                : state === "unavailable"
                  ? "Local facial history is unavailable."
                  : "No completed facial-expression results on this installation."}
            </p>
          )}
          <div className="flex gap-3 text-sm leading-6 text-muted-foreground">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p>
              Camera access is never started from this page. You can choose facial capture while writing a reflection,
              and its availability depends on the analysis service.
            </p>
          </div>
        </EchoCard>
        <PrivacyNotice />
      </div>
    </VerifiedFeatureGate>
  );
}
