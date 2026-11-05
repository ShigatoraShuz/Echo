"use client";
import {useEffect,useState} from 'react';
import {modelPageLeaseSchema} from '@echo/contracts';
import {env} from '@/config/environment';
import {supabaseAuthTokenProvider} from '@/infrastructure/api/supabase-auth-token-provider';

async function request(path:string,method:string,body?:unknown){
 const token=await supabaseAuthTokenProvider.getAccessToken();
 const response=await fetch(env.apiBaseUrl+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store',keepalive:method==='DELETE',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Journal model preparation is unavailable. Check analysis consent and access.');
 return (await response.json()).data;
}
/** Mounted in Journal layout so section navigation retains one owner. */
export function JournalRuntimeOwner(){
 const [state,setState]=useState('unloaded');
 useEffect(()=>{
  if(process.env.NEXT_PUBLIC_PAGE_MODEL_LEASES!=='true')return;
  let ended=false,id:string|undefined,polling=false,renewing=false;
  let poll:ReturnType<typeof setInterval>|undefined,heartbeat:ReturnType<typeof setInterval>|undefined;
  const controller=new AbortController();
  const release=()=>{if(ended)return;ended=true;controller.abort();if(poll)clearInterval(poll);if(heartbeat)clearInterval(heartbeat);if(id)void request('/ai/runtime/leases/'+id+'?profile=journal','DELETE').catch(()=>{});};
  window.addEventListener('pagehide',release);
  setState('preparing');
  void request('/ai/runtime/leases','POST',{profile:'journal',clientInstanceId:crypto.randomUUID()}).then(async raw=>{
   const lease=modelPageLeaseSchema.parse(raw);
   if(ended){await request('/ai/runtime/leases/'+lease.id+'?profile=journal','DELETE').catch(()=>{});return;}
   id=lease.id;setState(lease.state);
   if(lease.faceEligible){for(const asset of ['/models/face_landmarker.task','/vendor/mediapipe/vision_wasm_internal.wasm'])void fetch(asset,{signal:controller.signal,cache:'force-cache'}).catch(()=>{});}
   poll=setInterval(()=>{if(polling||!id)return;polling=true;void request('/ai/runtime/leases/'+id+'?profile=journal','GET').then(value=>{if(!ended)setState(modelPageLeaseSchema.parse(value).state);}).catch(()=>{if(!ended)setState('failed');}).finally(()=>{polling=false;});},1000);
   heartbeat=setInterval(()=>{if(renewing||!id)return;renewing=true;void request('/ai/runtime/leases/'+id+'?profile=journal','PUT',{}).then(value=>{if(!ended)setState(modelPageLeaseSchema.parse(value).state);}).catch(()=>{if(!ended)setState('failed');}).finally(()=>{renewing=false;});},15000);
  }).catch(()=>{if(!ended)setState('failed');});
  return ()=>{window.removeEventListener('pagehide',release);release();};
 },[]);
 if(state==='unloaded'||state==='ready')return null;
 const text=state==='waiting_for_capacity'?'Journal analysis is waiting for Buddy to release GPU capacity.':state==='failed'?'Journal AI is not prepared. Check analysis consent and access; private writing remains available.':state==='releasing'?'Releasing Journal models…':'Preparing Journal models…';
 return <p role="status" className="mb-2 text-xs text-muted-foreground">{text}</p>;
}
