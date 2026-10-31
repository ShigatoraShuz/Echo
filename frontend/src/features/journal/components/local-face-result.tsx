"use client";
import { useEffect, useState } from "react";
import { facialExpressionResultSchema, type FacialExpressionResult } from "@echo/contracts";
import { env } from "@/config/environment";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";

export function LocalFaceResult({ entryId }: { entryId: string }) {
  const [value, setValue] = useState<FacialExpressionResult | null>(null),
    [status, setStatus] = useState("loading");
  useEffect(() => {
    setValue(null);
    setStatus("loading");
    const abort = new AbortController();
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const token = await supabaseAuthTokenProvider.getAccessToken();
        const res = await fetch(env.apiBaseUrl + "/journals/" + entryId + "/face", {
          headers: { Authorization: "Bearer " + token },
          signal: abort.signal,
          cache: "no-store",
        });
        if (!res.ok) throw Error();
        const { data } = await res.json();
        if (abort.signal.aborted) return;
        setStatus(data.status);
        setValue(data.result ? facialExpressionResultSchema.parse(data.result) : null);
        if (["queued", "analyzing", "captured_pending_provider"].includes(data.status) && ++polls < 90)
          timer = setTimeout(load, 4000);
      } catch {
        if (!abort.signal.aborted) setStatus("unavailable");
      }
    }
    void load();
    return () => {
      abort.abort();
      if (timer) clearTimeout(timer);
    };
  }, [entryId]);
  return (
    <section aria-label="Local facial expression" className="rounded-xl border border-border p-4">
      <h3 className="font-semibold">Experimental facial expression</h3>
      <p className="text-xs text-muted-foreground">
        A visible expression estimate, separate from text emotions. It does not establish how you feel or a clinical
        condition.
      </p>
      {value?.status === "available" ? (
        <>
          <p className="mt-2 font-semibold capitalize">{value.prediction}</p>
          <p className="text-xs">Uncalibrated model scores; these are not confidence measurements.</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
            {Object.entries(value.classProbabilities).map(([name, score]) => (
              <li key={name}>
                {name}: {score.toFixed(3)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">Captured estimate: {new Date(value.generatedAt).toLocaleString()}</p>
          {value.quality.warning_flags && (
            <p className="text-xs">Capture quality warnings: {String(value.quality.warning_flags)}</p>
          )}
        </>
      ) : (
        <p role="status" className="mt-2 text-sm">
          {["queued", "analyzing", "captured_pending_provider", "loading"].includes(status)
            ? "Waiting for local facial analysis."
            : value?.status === "unavailable" && value.reason === "no_usable_face"
              ? "No usable single face was found. Your text results remain available."
              : "No facial result is available for this reflection."}
        </p>
      )}
    </section>
  );
}
