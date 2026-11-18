"use client";
import { useEffect, useState, useRef } from "react";
import {JournalFaceCapture,type JournalFaceCaptureHandle} from './journal-face-capture';
import {journalSignalComparisonSchema,type JournalSignalComparison, facialExpressionResultSchema, type FacialExpressionResult } from "@echo/contracts";
import { env } from "@/config/environment";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";

export function LocalFaceResult({ entryId }: { entryId: string }) {
  const [value, setValue] = useState<FacialExpressionResult | null>(null),
    [status, setStatus] = useState("loading");
  const [revision,setRevision]=useState(0);
  const [capturing,setCapturing]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const capture=useRef<JournalFaceCaptureHandle>(null);
  const actionAbort=useRef<AbortController|null>(null);
  useEffect(()=>{setCapturing(false);setNotice('');setBusy(false);return()=>actionAbort.current?.abort();},[entryId]);
  useEffect(()=>{const refresh=()=>setRevision(value=>value+1);window.addEventListener('echo:analysis-completed',refresh);window.addEventListener('echo:journal-changed',refresh);return()=>{window.removeEventListener('echo:analysis-completed',refresh);window.removeEventListener('echo:journal-changed',refresh);};},[]);
  async function recover(face:boolean){
    if(busy)return;setBusy(true);setNotice('');
    const abort=new AbortController();actionAbort.current=abort;
    try{
      const token=await supabaseAuthTokenProvider.getAccessToken();
      const image=face?await capture.current?.getStill():undefined;
      if(face&&!image)throw Error('Capture a clear single face first.');
      const response=await fetch(env.apiBaseUrl+'/journals/'+entryId+(face?'/face':'/reanalyze'),{method:'POST',headers:{Authorization:'Bearer '+token,...(face?{'Content-Type':'image/jpeg'}:{})},body:image,signal:abort.signal});
      if(!response.ok)throw Error('Could not start analysis. Check journal and facial-analysis consent, then retry.');
      const accepted=await response.json();
      if(abort.signal.aborted)return;
      capture.current?.stop();setCapturing(false);setRevision(value=>value+1);setNotice(face?'New face capture submitted.':accepted.data?.requiresFaceCapture?'Text analysis queued. Capture your facial expression again.':'Analyzing the current journal text.');
    }catch(error){if(!abort.signal.aborted)setNotice(error instanceof Error?error.message:'Could not start analysis.');}
    finally{if(!abort.signal.aborted)setBusy(false);}
  }
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
        <p className={comparison?.status==='different'?'text-sm font-semibold text-primary':'text-sm'}>{comparison?.status==='same'?'Same leading label':comparison?.status==='different'?'Different leading labels':'Comparison unavailable'}</p>
        {comparison?.textEmotion&&<p className="text-sm capitalize">Written text: {comparison.textEmotion}{comparison.faceEmotion?` · Facial expression: ${comparison.faceEmotion}`:''}</p>}
        {comparison?.reason==='consent_required'&&<p className="text-xs">Enable journal analysis and facial-analysis consent in Settings to compare these signals.</p>}
        {comparison?.reason!=='consent_required'&&comparison?.status==='unavailable'&&<>
          {comparison.textState&&comparison.textState!=='current'&&<p className="text-xs">{comparison.textState==='unverified'?'The saved text result has no verifiable source revision.':comparison.textState==='stale'?'The text result belongs to an older journal version.':'Text analysis is missing.'} Analyze this version of your journal.</p>}
          {comparison.faceState&&comparison.faceState!=='current'&&<p className="text-xs">{comparison.faceState==='unverified'?'The saved face capture has no verifiable source revision.':comparison.faceState==='stale'?'The face capture belongs to an older journal version.':'A usable face capture is missing.'} Capture your facial expression again.</p>}
          {!comparison.textState&&!comparison.faceState&&<p className="text-xs">These saved signals cannot be verified against the current journal text. Analyze this version and capture your expression again.</p>}
          {comparison.textState!=='current'&&<button type="button" disabled={busy} className="mt-2 text-sm underline" onClick={()=>void recover(false)}>Analyze current text</button>}
          {comparison.faceState!=='current'&&<button type="button" disabled={busy} className="ml-3 mt-2 text-sm underline" onClick={()=>setCapturing(value=>!value)}>Capture expression again</button>}
        </>}
        {capturing&&<div className="mt-3"><JournalFaceCapture ref={capture} running/><button type="button" disabled={busy} onClick={()=>void recover(true)}>Use this capture</button><button type="button" disabled={busy} onClick={()=>{capture.current?.stop();setCapturing(false);}}>Cancel capture</button></div>}
        {notice&&<p role="status" className="mt-2 text-xs">{notice}</p>}
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
