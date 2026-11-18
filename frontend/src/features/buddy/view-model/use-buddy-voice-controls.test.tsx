import {act,renderHook,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('@/infrastructure/api/supabase-auth-token-provider',()=>({supabaseAuthTokenProvider:{getAccessToken:vi.fn().mockResolvedValue('synthetic-token')}}));
vi.mock('@/config/environment',()=>({env:{apiBaseUrl:'http://127.0.0.1:4200/api/v1'}}));
import {useBuddyVoiceControls} from './use-buddy-voice-controls';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it('submits browser recognition as text and cancels it when changing provider',async()=>{
 let recognition:any;const abort=vi.fn();vi.stubGlobal('SpeechRecognition',class{onstart:any;onend:any;onresult:any;onerror:any;constructor(){recognition=this;}start(){this.onstart?.();}stop(){this.onend?.();}abort=abort;});
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const accepted=vi.fn();
 const hook=renderHook(({provider}:{provider:'browser'|'whisper'})=>useBuddyVoiceControls(provider),{initialProps:{provider:'browser'}});
 await act(async()=>hook.result.current.startListening(accepted));act(()=>{recognition.onresult({resultIndex:0,results:[{isFinal:true,0:{transcript:'Browser message.'}}]});recognition.onend();});
 expect(accepted).toHaveBeenCalledExactlyOnceWith('Browser message.');expect(fetcher).not.toHaveBeenCalled();
 await act(async()=>hook.result.current.startListening(accepted));const late=recognition.onend;hook.rerender({provider:'whisper'});act(()=>late());expect(abort).toHaveBeenCalled();expect(accepted).toHaveBeenCalledTimes(1);hook.unmount();
});
it('uses stored message identifiers and fences speech when switching bubbles',async()=>{
 const id='10000000-0000-4000-8000-000000000001';
 const fetcher=vi.fn(async(url:string,options:RequestInit)=>{
  if(options.method==='DELETE')return new Response(null,{status:204});
  if(url.endsWith('/jobs'))return Response.json({data:{id,state:'preparing'}});
  if(url.endsWith('/jobs/'+id))return Response.json({data:{id,state:'prepared'}});
  return Response.json({error:{code:'BUDDY_MOSS_NATIVE_TIMEOUT'}},{status:503});
 });vi.stubGlobal('fetch',fetcher);
 const hook=renderHook(()=>useBuddyVoiceControls());
 await act(async()=>hook.result.current.speak('Client text',{messageId:'first',conversationId:'owned'}));
 expect(hook.result.current.activeMessageId).toBe('first');
 await act(async()=>hook.result.current.speak('Second',{messageId:'second',conversationId:'owned'}));
 expect(hook.result.current.activeMessageId).toBe('second');
 const calls=fetcher.mock.calls.filter(([url])=>url.includes('/speak'));
 expect(calls.map(([,o])=>JSON.parse(String(o.body)))).toEqual([{messageId:'first',conversationId:'owned'},{messageId:'second',conversationId:'owned'}]);
 await act(async()=>hook.result.current.speak('Server welcome',{messageId:'welcome',conversationId:'owned'}));
 const welcomeCall=fetcher.mock.calls.filter(([url])=>url.includes('/speak')).at(-1)!;
 expect(JSON.parse(String(welcomeCall[1].body))).toEqual({text:'Server welcome'});
 act(()=>hook.result.current.cancel());expect(hook.result.current.activeMessageId).toBeNull();
 hook.unmount();
});
it('shows preparation while the response is pending and cancellation fences late audio',async()=>{
 let finish!:(r:Response)=>void;
 const fetcher=vi.fn(()=>new Promise<Response>(r=>finish=r));vi.stubGlobal('fetch',fetcher);
 const audio=vi.fn();vi.stubGlobal('Audio',audio);
 const hook=renderHook(()=>useBuddyVoiceControls());let pending!:Promise<void>;
 act(()=>{pending=hook.result.current.speak('Approved answer');});
 await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
 expect(hook.result.current.isPreparingSpeech).toBe(true);expect(hook.result.current.isSpeaking).toBe(false);
 act(()=>hook.result.current.stopSpeaking());
 await act(async()=>{finish(new Response('audio'));await pending;});
 expect(hook.result.current.isPreparingSpeech).toBe(false);expect(audio).not.toHaveBeenCalled();hook.unmount();
});
it('keeps safe MOSS errors and retries only synthesis of the approved answer',async()=>{
 const id='10000000-0000-4000-8000-000000000001';
 const fetcher=vi.fn(async(url:string,options:RequestInit)=>{
  if(options.method==='DELETE')return new Response(null,{status:204});
  if(url.endsWith('/jobs'))return Response.json({data:{id,state:'preparing'}});
  if(url.endsWith('/jobs/'+id))return Response.json({data:{id,state:'prepared'}});
  return Response.json({error:{code:'BUDDY_MOSS_INFERENCE_TIMEOUT',message:'PRIVATE REJECTED DRAFT'}},{status:503});
 });vi.stubGlobal('fetch',fetcher);
 const hook=renderHook(()=>useBuddyVoiceControls());
 await act(async()=>hook.result.current.speak('Approved answer'));
 expect(hook.result.current.voiceError).toContain('timed out');expect(hook.result.current.voiceError).not.toContain('PRIVATE');
 expect(hook.result.current.isPreparingSpeech).toBe(false);
 await act(async()=>hook.result.current.speak('Approved answer'));
 const speechCalls=fetcher.mock.calls.filter(([url])=>url.includes('/buddy/voice/speak'));
 expect(speechCalls).toHaveLength(2);
 expect(fetcher.mock.calls.some(([url])=>url.includes('/buddy/messages'))).toBe(false);
 for(const [url,options] of speechCalls as unknown as [string,RequestInit][]) {
  expect(url).toContain('/buddy/voice/speak');expect(options.body).toBe(JSON.stringify({text:'Approved answer'}));
 }
 hook.unmount();
});
