"use client";
import {useEffect,useState,useRef} from 'react';
import {modelPageLeaseSchema} from '@echo/contracts';
import {startModelLease} from "@/shared/lib/model-lease-session";
import {env} from '@/config/environment';
import {supabaseAuthTokenProvider} from '@/infrastructure/api/supabase-auth-token-provider';

async function request(path:string,method:string,body?:unknown){
 const token=await supabaseAuthTokenProvider.getAccessToken();
 const response=await fetch(env.apiBaseUrl+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store',keepalive:method==='DELETE',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Object.assign(Error('Journal model preparation is unavailable. Check analysis consent and access.'),{status:response.status});
 return (await response.json()).data;
}
/** Mounted in Journal layout so section navigation retains one owner. */
export function JournalRuntimeOwner(){
 const [state,setState]=useState('unloaded');
 const recovery=useRef<ReturnType<typeof startModelLease>|null>(null);
 useEffect(()=>{
  if(process.env.NEXT_PUBLIC_PAGE_MODEL_LEASES!=='true')return;
 const client = crypto.randomUUID(); const assets = new AbortController(); let prefetched = false;
 const session = startModelLease({
   acquire: async () => modelPageLeaseSchema.parse(await request('/ai/runtime/leases','POST',{profile:'journal',clientInstanceId:client})),
   status: async id => modelPageLeaseSchema.parse(await request('/ai/runtime/leases/'+id+'?profile=journal','GET')),
   heartbeat: async id => modelPageLeaseSchema.parse(await request('/ai/runtime/leases/'+id+'?profile=journal','PUT',{})),
   release: id => request('/ai/runtime/leases/'+id+'?profile=journal','DELETE'),
   change: lease => { setState(lease.state); if(lease.faceEligible && !prefetched){ prefetched=true;
     for(const asset of ['/models/face_landmarker.task','/vendor/mediapipe/vision_wasm_internal.wasm'])void fetch(asset,{signal:assets.signal,cache:'force-cache'}).catch(()=>{});
   } },
   error: () => setState('failed'),
 });
 recovery.current=session;
 const leave=()=>{assets.abort();session.stop();if(recovery.current===session)recovery.current=null;};
 window.addEventListener('pagehide',leave); window.addEventListener('focus',session.retry);
 return ()=>{window.removeEventListener('pagehide',leave);window.removeEventListener('focus',session.retry);leave();};
 },[]);
 if(state==='unloaded'||state==='ready')return null;
 const text=state==='waiting_for_capacity'?'Journal analysis is waiting for Buddy to release GPU capacity.':state==='failed'?'Journal AI is not prepared. Check analysis consent and access; private writing remains available.':state==='releasing'?'Releasing Journal models…':'Preparing Journal models…';
 return <p role="status" className="mb-2 text-xs text-muted-foreground">{text}{state==='failed'&&<button type="button" onClick={()=>recovery.current?.retry()} className="ml-2 font-semibold text-primary underline">Retry models</button>}</p>;
}
