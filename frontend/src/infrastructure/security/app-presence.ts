import {env} from '@/config/environment';
import {createBrowserSupabaseClient} from '@/infrastructure/supabase/browser-client';
let tabId:string|undefined;
export const appPresenceEnabled=process.env.NEXT_PUBLIC_APP_PRESENCE==='true';
export async function updateAppPresence(action:'register'|'heartbeat'|'release'|'logout'){
 if(!appPresenceEnabled)return {closed:false};
 const {data}=await createBrowserSupabaseClient().auth.getSession();
 const token=data.session?.access_token;if(!token)return {closed:true};
 tabId??=crypto.randomUUID();
 const response=await fetch(env.apiBaseUrl+'/session/presence',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({tabId,action}),keepalive:action==='release'||action==='logout',signal:AbortSignal.timeout(10000),cache:'no-store',
 });
 if(response.status===401)return {closed:true};
 if(!response.ok)throw Error('Session service unavailable');
 return (await response.json()).data as {closed:boolean};
}
export function broadcastLogout(){
 try{localStorage.setItem('echo:logout-event',crypto.randomUUID());}catch{}
 if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel('echo:session');channel.postMessage({type:'logout'});channel.close();}
}
