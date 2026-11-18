"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {Mic,Square,LoaderCircle} from 'lucide-react';
import {voiceOperationSchema} from '@echo/contracts';
import {env} from '@/config/environment';
import {supabaseAuthTokenProvider} from '@/infrastructure/api/supabase-auth-token-provider';
import type {SttProvider} from '@echo/contracts';
import {startBrowserSpeech,type BrowserSpeechCapture} from '@/shared/browser-speech';
import {SttProviderSelect} from '@/shared/components/stt-provider-select';

export function appendJournalTranscript(body:string,text:string){
  const separator=!body||body.endsWith('\n\n')?'':body.endsWith('\n')?'\n':'\n\n';
  return body+separator+text.trim();
}
type State='idle'|'preparing'|'recording'|'transcribing';
export function JournalDictationControl({body,onChange,identity,disabled=false,onBusyChange,onStart}:{body:string;onChange:(value:string)=>void;identity:string|number;disabled?:boolean;onBusyChange?:(busy:boolean)=>void;onStart?:()=>void}){
  const [state,setState]=useState<State>('idle'),[error,setError]=useState(''),[overflow,setOverflow]=useState('');
  const [provider,setProvider]=useState<SttProvider>('whisper');
  const browserCapture=useRef<BrowserSpeechCapture|null>(null);
  const latest=useRef({body,onChange,onBusyChange,onStart,disabled});latest.current={body,onChange,onBusyChange,onStart,disabled};
  const epoch=useRef(0),controller=useRef<AbortController|null>(null),stream=useRef<MediaStream|null>(null),recorder=useRef<MediaRecorder|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),job=useRef<{id:string;token:string}|null>(null);
  const base=env.apiBaseUrl+'/journals/dictation/jobs';
  const deleteJob=useCallback((value:{id:string;token:string}|null)=>{if(value)void fetch(base+'/'+value.id,{method:'DELETE',headers:{Authorization:'Bearer '+value.token},signal:AbortSignal.timeout(10000),keepalive:true}).catch(()=>{});},[base]);
  const clean=useCallback(()=>{
    browserCapture.current?.cancel();browserCapture.current=null;
    controller.current?.abort();controller.current=null;
    if(timer.current)clearTimeout(timer.current);timer.current=null;
    if(recorder.current){recorder.current.onstop=null;recorder.current.ondataavailable=null;recorder.current.onerror=null;if(recorder.current.state==='recording')recorder.current.stop();}recorder.current=null;
    stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;
    deleteJob(job.current);job.current=null;
  },[deleteJob]);
  const cancel=useCallback(()=>{epoch.current++;clean();setState('idle');latest.current.onBusyChange?.(false);},[clean]);
  useEffect(()=>{cancel();setError('');setOverflow('');return cancel;},[identity,cancel]);
  useEffect(()=>{if(disabled)cancel();},[disabled,cancel]);
  useEffect(()=>{cancel();},[provider,cancel]);
  useEffect(()=>{const leave=()=>cancel();window.addEventListener('pagehide',leave);return()=>window.removeEventListener('pagehide',leave);},[cancel]);
  const finish=()=>{if(timer.current)clearTimeout(timer.current);browserCapture.current?.stop();if(recorder.current?.state==='recording')recorder.current.stop();};
  async function start(){
    cancel();setError('');setOverflow('');
    if(provider==='whisper'&&(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')){setError('Microphone recording requires a supported browser on HTTPS or localhost.');return;}
    const current=epoch.current,abort=new AbortController();controller.current=abort;
    const active=()=>current===epoch.current&&!abort.signal.aborted&&!latest.current.disabled;
    const fail=(message:string)=>{if(current!==epoch.current)return;cancel();setError(message);};
    latest.current.onBusyChange?.(true);latest.current.onStart?.();setState('preparing');
    const append=(text:string)=>{
      if(!active())return;
      const next=appendJournalTranscript(latest.current.body,text);
      if(next.length>10000){setOverflow(text);setError('The transcript does not fit the 10,000-character journal limit. Copy it below; your writing is unchanged.');}
      else latest.current.onChange(next);
      cancel();
    };
    if(provider==='browser'){
      try{browserCapture.current=startBrowserSpeech({onStart:()=>{if(active())setState('recording');},onFinal:append,onError:fail});}
      catch(error){fail(error instanceof Error?error.message:'Browser speech is unavailable. Choose Whisper.');}
      return;
    }
    const call=async(suffix:string,method='GET',payload?:BodyInit,type='application/json')=>{
      const token=await supabaseAuthTokenProvider.getAccessToken();if(!active())throw new DOMException('Cancelled','AbortError');
      const response=await fetch(base+suffix,{method,headers:{Authorization:'Bearer '+token,'Content-Type':type},body:payload,cache:'no-store',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(30000)])});
      if(!response.ok){const data=await response.json().catch(()=>null);throw Error(data?.error?.code==='TALK_BUSY'||data?.error?.code==='VOICE_BUSY'?'Finish the current voice operation and try dictation again.':'Whisper transcription is unavailable. Your writing is retained; try recording again.');}return response;
    };
    const pause=()=>new Promise<void>((resolve,reject)=>{
      const stop=()=>{clearTimeout(id);reject(new DOMException('Cancelled','AbortError'));};const id=setTimeout(()=>{abort.signal.removeEventListener('abort',stop);resolve();},1000);abort.signal.addEventListener('abort',stop,{once:true});if(abort.signal.aborted)stop();
    });
    const wait=async(target:'prepared'|'complete',ms:number)=>{
      const deadline=Date.now()+ms;
      while(active()&&Date.now()<deadline){const value=voiceOperationSchema.parse((await (await call('/'+job.current!.id)).json()).data);if(value.state==='failed')throw Error('Whisper could not process this recording. Your writing is retained; try again.');if(value.state===target)return;await pause();}
      throw Error('Dictation timed out. Your writing is retained; try recording again.');
    };
    try{
      const microphone=await navigator.mediaDevices.getUserMedia({audio:true});if(!active()){microphone.getTracks().forEach(t=>t.stop());return;}stream.current=microphone;
      const token=await supabaseAuthTokenProvider.getAccessToken();
      const response=await fetch(base,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({provider}),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])});
      if(!response.ok)throw Error('Speech preparation is unavailable. Your writing is retained; try again.');
      const created=voiceOperationSchema.parse((await response.json()).data),owned={id:created.id,token:token!};
      if(!active()){deleteJob(owned);return;}job.current=owned;
      await wait('prepared',210000);if(!active())return;
      const chunks:BlobPart[]=[];let bytes=0;const recording=new MediaRecorder(microphone);recorder.current=recording;
      recording.ondataavailable=event=>{if(!active())return;bytes+=event.data.size;if(bytes>10*1024*1024){fail('Recording exceeds 10 MiB. Your writing is retained.');return;}chunks.push(event.data);};
      recording.onerror=()=>fail('Recording failed. Your writing is retained; try again.');
      recording.onstop=()=>{microphone.getTracks().forEach(t=>t.stop());if(!active()){chunks.length=0;return;}setState('transcribing');
        void(async()=>{try{
          const blob=new Blob(chunks,{type:recording.mimeType});chunks.length=0;
          if(!blob.size)throw Error('No audio was recorded. Try again.');
          await call('/'+owned.id+'/audio','POST',blob,'application/octet-stream');await wait('complete',600000);
          const result=await(await call('/'+owned.id+'/result')).json();if(!active())return;
          const text=typeof result.data?.text==='string'?result.data.text.trim():'';
          if(!text)throw Error('No speech detected. Your writing is retained; try recording again.');
          append(text);
        }catch(cause){fail(cause instanceof Error?cause.message:'Transcription failed. Your writing is retained.');}})();
      };
      recording.start(1000);setState('recording');timer.current=setTimeout(finish,59000);
    }catch(cause){fail(cause instanceof DOMException&&cause.name==='NotAllowedError'?'Microphone permission was denied. Allow microphone access to dictate.':cause instanceof Error?cause.message:'Dictation is unavailable. Your writing is retained.');}
  }
  return <div className="my-3 space-y-2">
    <SttProviderSelect value={provider} onChange={setProvider} disabled={disabled||state!=='idle'}/>
    <div className="flex flex-wrap items-center gap-3">
      {state==='idle'?<button type="button" disabled={disabled} onClick={()=>void start()} className="echo-button-secondary inline-flex items-center gap-2 disabled:opacity-50"><Mic size={16} aria-hidden="true"/>Dictate</button>:<>
        {state==='recording'&&<button type="button" onClick={finish} className="echo-button-secondary inline-flex items-center gap-2"><Square size={16} aria-hidden="true"/>Stop and transcribe</button>}
        <button type="button" onClick={cancel} className="text-sm underline">Cancel dictation</button>
      </>}
      {state!=='idle'&&<span role="status" className="inline-flex items-center gap-2 text-sm">{state!=='recording'&&<LoaderCircle size={15} className="animate-spin" aria-hidden="true"/>}{state==='preparing'?`Preparing ${provider==='browser'?'browser speech':'Whisper'}…`:state==='recording'?'Recording · up to 59 seconds':'Transcribing…'}</span>}
    </div>
    <p className="text-xs text-muted-foreground">Echo does not save dictation audio.</p>
    {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
    {overflow&&<><textarea readOnly aria-label="Transcript that exceeds the journal limit" value={overflow} className="w-full rounded-xl border p-3"/><button type="button" onClick={()=>void navigator.clipboard.writeText(overflow).catch(()=>setError('Select and copy the transcript above.'))}>Copy transcript</button></>}
  </div>;
}
