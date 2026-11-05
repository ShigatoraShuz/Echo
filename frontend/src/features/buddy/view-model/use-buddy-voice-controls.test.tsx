import {act,renderHook,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('@/infrastructure/api/supabase-auth-token-provider',()=>({supabaseAuthTokenProvider:{getAccessToken:vi.fn().mockResolvedValue('synthetic-token')}}));
vi.mock('@/config/environment',()=>({env:{apiBaseUrl:'http://127.0.0.1:4200/api/v1'}}));
import {useBuddyVoiceControls} from './use-buddy-voice-controls';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
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
it('keeps safe Nano errors and retries only synthesis of the approved answer',async()=>{
 const fetcher=vi.fn(async()=>Response.json({error:{code:'BUDDY_NANO_LOAD_TIMEOUT',message:'PRIVATE REJECTED DRAFT'}},{status:503}));vi.stubGlobal('fetch',fetcher);
 const hook=renderHook(()=>useBuddyVoiceControls());
 await act(async()=>hook.result.current.speak('Approved answer'));
 expect(hook.result.current.voiceError).toContain('timed out');expect(hook.result.current.voiceError).not.toContain('PRIVATE');
 expect(hook.result.current.isPreparingSpeech).toBe(false);
 await act(async()=>hook.result.current.speak('Approved answer'));
 expect(fetcher).toHaveBeenCalledTimes(2);
 for(const [url,options] of fetcher.mock.calls as unknown as [string,RequestInit][]) {
  expect(url).toContain('/buddy/voice/speak');expect(options.body).toBe(JSON.stringify({text:'Approved answer'}));
 }
 hook.unmount();
});
