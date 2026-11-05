"use client";
import { useEffect, useState } from "react";
import {journalSignalComparisonSchema,type JournalSignalComparison, facialExpressionResultSchema, type FacialExpressionResult } from "@echo/contracts";
import { env } from "@/config/environment";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";

export function LocalFaceResult({ entryId }: { entryId: string }) {
  const [value, setValue] = useState<FacialExpressionResult | null>(null),
    [status, setStatus] = useState("loading");
  const [revision,setRevision]=useState(0);
  useEffect(()=>{const refresh=()=>setRevision(value=>value+1);window.addEventListener('echo:analysis-completed',refresh);return()=>window.removeEventListener('echo:analysis-completed',refresh);},[]);
  const [comparison,setComparison]=useState<JournalSignalComparison|null>(null);
  useEffect(() => {
    setValue(null);setComparison(null);
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
        setComparison(data.comparison?journalSignalComparisonSchema.parse(data.comparison):null);
        setValue(data.result ? facialExpressionResultSchema.parse(data.result) : null);
        if ((["queued", "analyzing", "captured_pending_provider"].includes(data.status)||(data.result?.status==='available'&&data.comparison?.reason==='missing_signal')) && ++polls < 90)
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
  }, [entryId,revision]);
  return (
    <section aria-label="Local facial expression" className="rounded-xl border border-border p-4">
      <h3 className="font-semibold">Experimental facial expression</h3>
      <p className="text-xs text-muted-foreground">
        A visible expression estimate, separate from text emotions. It does not establish how you feel or a clinical
        condition.
      </p>
      <div aria-label="Text and facial expression comparison" className="mt-3 rounded-xl border border-border p-3">
        <h4 className="text-sm font-semibold">Text and facial expression comparison</h4>
        <p className="text-sm">{comparison?.status==='same'?'Same leading label':comparison?.status==='different'?'Different leading labels':'Comparison unavailable'}</p>
        {comparison?.textEmotion&&<p className="text-sm capitalize">Written text: {comparison.textEmotion} · Facial expression: {comparison.faceEmotion}</p>}
        {comparison?.reason==='stale_revision'&&<p className="text-xs">These saved signals cannot be verified against the current journal revision.</p>}
        <p className="mt-1 text-xs text-muted-foreground">Writing and facial expression can show different signals. This comparison does not establish how you feel.</p>
      </div>
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
