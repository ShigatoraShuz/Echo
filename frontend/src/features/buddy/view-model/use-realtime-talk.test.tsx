/* Browser API doubles exercise permission and capture lifetime, not hardware audio. */
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act,renderHook,waitFor} from '@testing-library/react';
vi.hoisted(()=>{process.env.NEXT_PUBLIC_REALTIME_TALK='true';});
vi.mock('@/config/environment',()=>({env:{apiBaseUrl:'http://localhost:4200/api/v1'}}));
vi.mock('@/infrastructure/api/supabase-auth-token-provider',()=>({supabaseAuthTokenProvider:{getAccessToken:async()=> 'synthetic'}}));
import {useRealtimeTalk} from './use-realtime-talk';
const id='11111111-1111-4111-8111-111111111111';
let contexts:Context[]=[];let sockets:Socket[]=[];
class Context{
 state='running';destination={};createAnalyser=()=>({fftSize:0,connect:vi.fn()});
 audioWorklet={addModule:vi.fn().mockResolvedValue(undefined)};
 createMediaStreamSource=vi.fn(()=>({connect:vi.fn(),disconnect:vi.fn()}));
 resume=vi.fn(async()=>{this.state='running';});suspend=vi.fn(async()=>{this.state='suspended';});close=vi.fn(async()=>{this.state='closed';});
 constructor(){contexts.push(this);}
}
class Socket{
 static OPEN=1;readyState=1;bufferedAmount=0;
 onopen:(()=>void)|null=null;onerror:(()=>void)|null=null;onclose:(()=>void)|null=null;onmessage:((event:{data:string})=>void)|null=null;
 send=vi.fn();close=vi.fn(()=>{this.readyState=3;});
 constructor(_url:string){sockets.push(this);}
 ready(){this.onmessage?.({data:JSON.stringify({protocol:'echo-buddy-talk-v2',sessionId:id,generation:0,type:'ready',runtime:{whisperDevice:'cpu'}})});}
}
const node=()=>({connect:vi.fn(),disconnect:vi.fn(),port:{onmessage:null}});
const options={conversationId:null,getTemporarySessionId:()=>id,onMessage:vi.fn(),onDelivery:vi.fn()};
function stream(){const track={enabled:true,readyState:'live',stop:vi.fn(),onended:null};return {track,value:{getTracks:()=>[track],getAudioTracks:()=>[track]} as unknown as MediaStream};}
function sessionResponse(){return new Response(JSON.stringify({data:{sessionId:id,expiresAt:new Date(Date.now()+600000).toISOString(),webSocketPath:'/api/v1/buddy/voice/stream',ticket:'a'.repeat(64)}}));}
beforeEach(()=>{
 contexts=[];sockets=[];
 vi.stubGlobal('AudioContext',Context);vi.stubGlobal('AudioWorkletNode',vi.fn(function(){return node();}));vi.stubGlobal('WebSocket',Socket);
 vi.stubGlobal('fetch',vi.fn(async()=>sessionResponse()));
});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
function media(getUserMedia:ReturnType<typeof vi.fn>){Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia},configurable:true});}
it('requests microphone immediately and loads the session while permission is pending; capture waits for ready',async()=>{
 let grant!:(s:MediaStream)=>void;const getUserMedia=vi.fn(()=>new Promise<MediaStream>(r=>grant=r));media(getUserMedia);
 const hook=renderHook(()=>useRealtimeTalk(options));let started!:Promise<void>;
 act(()=>{started=hook.result.current.start();expect(getUserMedia).toHaveBeenCalledTimes(1);});
 await act(async()=>{await started;});expect(sockets).toHaveLength(1);expect(hook.result.current.state).toBe('preparing');
 const microphone=stream();await act(async()=>{grant(microphone.value);await Promise.resolve();});
 expect(microphone.track.enabled).toBe(false);expect(contexts[0].audioWorklet.addModule).not.toHaveBeenCalled();
 await act(async()=>sockets[0].ready());await waitFor(()=>expect(hook.result.current.state).toBe('listening'));
 expect(getUserMedia).toHaveBeenCalledTimes(1);expect(microphone.track.enabled).toBe(true);expect(contexts[0].audioWorklet.addModule).toHaveBeenCalledTimes(1);
 hook.unmount();expect(microphone.track.stop).toHaveBeenCalled();
});
it('Stop releases a late permission result without starting capture',async()=>{
 let grant!:(s:MediaStream)=>void;media(vi.fn(()=>new Promise<MediaStream>(r=>grant=r)));
 const hook=renderHook(()=>useRealtimeTalk(options));await act(async()=>hook.result.current.start());
 act(()=>hook.result.current.stop());const microphone=stream();await act(async()=>{grant(microphone.value);await Promise.resolve();});
 expect(microphone.track.stop).toHaveBeenCalledTimes(1);expect(contexts[0].audioWorklet.addModule).not.toHaveBeenCalled();expect(hook.result.current.active).toBe(false);
 hook.unmount();
});
it('permission denial cancels preparation without a second permission request',async()=>{
 const getUserMedia=vi.fn().mockRejectedValue(new Error('denied'));media(getUserMedia);
 const hook=renderHook(()=>useRealtimeTalk(options));await act(async()=>hook.result.current.start());
 expect(hook.result.current.state).toBe('unavailable');expect(hook.result.current.error).toMatch(/Microphone access/);expect(hook.result.current.active).toBe(false);expect(getUserMedia).toHaveBeenCalledTimes(1);expect(contexts[0].close).toHaveBeenCalled();
 hook.unmount();
});
it('Stop during session creation releases permitted media and deletes a late session',async()=>{
 const microphone=stream();media(vi.fn().mockResolvedValue(microphone.value));let finish!:(v:Response)=>void;
 const fetcher=vi.fn().mockImplementationOnce(()=>new Promise<Response>(r=>finish=r)).mockResolvedValue(new Response(JSON.stringify({data:{closed:true}})));vi.stubGlobal('fetch',fetcher);
 const hook=renderHook(()=>useRealtimeTalk(options));let started!:Promise<void>;act(()=>{started=hook.result.current.start();});
 await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));act(()=>hook.result.current.stop());expect(microphone.track.stop).toHaveBeenCalled();
 await act(async()=>{finish(sessionResponse());await started;});
 await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));expect(fetcher.mock.calls[1][1].method).toBe('DELETE');expect(sockets).toHaveLength(0);expect(hook.result.current.active).toBe(false);
 hook.unmount();
});
it('duplicate ready events cannot request or connect the microphone twice',async()=>{
 const microphone=stream();const getUserMedia=vi.fn().mockResolvedValue(microphone.value);media(getUserMedia);
 const hook=renderHook(()=>useRealtimeTalk(options));await act(async()=>hook.result.current.start());
 await act(async()=>{sockets[0].ready();sockets[0].ready();});
 await waitFor(()=>expect(hook.result.current.state).toBe('listening'));expect(getUserMedia).toHaveBeenCalledTimes(1);expect(contexts[0].createMediaStreamSource).toHaveBeenCalledTimes(1);
 hook.unmount();
});

it('a blocked AudioContext resume does not delay the model-session request',async()=>{
 const microphone=stream();media(vi.fn().mockResolvedValue(microphone.value));
 class BlockedContext extends Context{resume=vi.fn(()=>new Promise<void>(()=>{}));}
 vi.stubGlobal('AudioContext',BlockedContext);const hook=renderHook(()=>useRealtimeTalk(options));
 await act(async()=>hook.result.current.start());expect(fetch).toHaveBeenCalled();expect(sockets).toHaveLength(1);
 expect(contexts[0].audioWorklet.addModule).not.toHaveBeenCalled();hook.unmount();expect(microphone.track.stop).toHaveBeenCalled();
});
it('a microphone disconnected during model loading fails safely without capturing',async()=>{
 const microphone=stream();media(vi.fn().mockResolvedValue(microphone.value));
 const hook=renderHook(()=>useRealtimeTalk(options));await act(async()=>hook.result.current.start());microphone.track.readyState='ended';
 await act(async()=>sockets[0].ready());await waitFor(()=>expect(hook.result.current.state).toBe('unavailable'));
 expect(hook.result.current.error).toMatch(/microphone disconnected/);expect(contexts[0].audioWorklet.addModule).not.toHaveBeenCalled();expect(microphone.track.stop).toHaveBeenCalled();hook.unmount();
});

it('hiding while models load keeps preparation alive and requires explicit microphone resume',async()=>{
 let hidden=false;vi.spyOn(document,'hidden','get').mockImplementation(()=>hidden);
 const microphone=stream();const getUserMedia=vi.fn().mockResolvedValue(microphone.value);media(getUserMedia);
 const hook=renderHook(()=>useRealtimeTalk(options));await act(async()=>hook.result.current.start());
 act(()=>{hidden=true;document.dispatchEvent(new Event('visibilitychange'));});
 await act(async()=>sockets[0].ready());expect(hook.result.current.active).toBe(true);expect(hook.result.current.state).toBe('paused');expect(sockets[0].close).not.toHaveBeenCalled();expect(contexts[0].audioWorklet.addModule).not.toHaveBeenCalled();expect(microphone.track.enabled).toBe(false);
 act(()=>{hidden=false;document.dispatchEvent(new Event('visibilitychange'));});expect(hook.result.current.state).toBe('paused');expect(microphone.track.enabled).toBe(false);
 await act(async()=>hook.result.current.resumeTalk());expect(hook.result.current.state).toBe('listening');expect(getUserMedia).toHaveBeenCalledTimes(1);expect(microphone.track.enabled).toBe(true);hook.unmount();
});
it('hiding active listening suspends capture without closing the session or restarting it on return',async()=>{
 let hidden=false;vi.spyOn(document,'hidden','get').mockImplementation(()=>hidden);
 const microphone=stream();media(vi.fn().mockResolvedValue(microphone.value));const hook=renderHook(()=>useRealtimeTalk(options));
 await act(async()=>hook.result.current.start());await act(async()=>sockets[0].ready());await waitFor(()=>expect(hook.result.current.state).toBe('listening'));
 act(()=>{hidden=true;document.dispatchEvent(new Event('visibilitychange'));});expect(microphone.track.enabled).toBe(false);expect(contexts[0].suspend).toHaveBeenCalled();expect(sockets[0].close).not.toHaveBeenCalled();
 act(()=>{hidden=false;document.dispatchEvent(new Event('visibilitychange'));});expect(hook.result.current.state).toBe('paused');expect(microphone.track.enabled).toBe(false);
 await act(async()=>hook.result.current.resumeTalk());expect(hook.result.current.state).toBe('listening');expect(microphone.track.enabled).toBe(true);expect(contexts[0].createMediaStreamSource).toHaveBeenCalledTimes(1);hook.unmount();
});
it('true page exit still stops Talk and releases media',async()=>{
 const microphone=stream();media(vi.fn().mockResolvedValue(microphone.value));const hook=renderHook(()=>useRealtimeTalk(options));await act(async()=>hook.result.current.start());
 act(()=>window.dispatchEvent(new Event('pagehide')));expect(hook.result.current.active).toBe(false);expect(microphone.track.stop).toHaveBeenCalled();expect(sockets[0].close).toHaveBeenCalled();hook.unmount();
});

it('hiding an active utterance cancels that turn and recovery never resumes capture automatically',async()=>{
 let hidden=false;vi.spyOn(document,'hidden','get').mockImplementation(()=>hidden);
 const microphone=stream();media(vi.fn().mockResolvedValue(microphone.value));const hook=renderHook(()=>useRealtimeTalk(options));
 await act(async()=>hook.result.current.start());await act(async()=>sockets[0].ready());await waitFor(()=>expect(hook.result.current.state).toBe('listening'));
 const worklet=vi.mocked(AudioWorkletNode).mock.results[0].value;
 act(()=>{for(let i=0;i<15;i++)worklet.port.onmessage?.(new MessageEvent('message',{data:new Float32Array(512).fill(.1)}));});
 act(()=>{hidden=true;document.dispatchEvent(new Event('visibilitychange'));});
 expect(sockets[0].send.mock.calls.some(([value])=>typeof value==='string'&&JSON.parse(value).type==='cancel')).toBe(true);
 act(()=>{hidden=false;document.dispatchEvent(new Event('visibilitychange'));sockets[0].onmessage?.({data:JSON.stringify({protocol:'echo-buddy-talk-v2',sessionId:id,generation:1,type:'recovered'})});});
 expect(hook.result.current.state).toBe('paused');expect(microphone.track.enabled).toBe(false);expect(sockets[0].close).not.toHaveBeenCalled();
 await act(async()=>hook.result.current.resumeTalk());expect(microphone.track.enabled).toBe(true);hook.unmount();
});

it('explicit resume before loading finishes resumes audio and listens when readiness arrives',async()=>{
 let hidden=false;vi.spyOn(document,'hidden','get').mockImplementation(()=>hidden);
 const microphone=stream();media(vi.fn().mockResolvedValue(microphone.value));const hook=renderHook(()=>useRealtimeTalk(options));await act(async()=>hook.result.current.start());
 act(()=>{hidden=true;document.dispatchEvent(new Event('visibilitychange'));});act(()=>{hidden=false;document.dispatchEvent(new Event('visibilitychange'));});
 await act(async()=>hook.result.current.resumeTalk());expect(hook.result.current.state).toBe('preparing');expect(microphone.track.enabled).toBe(false);
 await act(async()=>sockets[0].ready());await waitFor(()=>expect(hook.result.current.state).toBe('listening'));expect(microphone.track.enabled).toBe(true);expect(sockets).toHaveLength(1);hook.unmount();
});

it('sends the selected expressive voice with Start Talk',async()=>{
 const microphone=stream();media(vi.fn(async()=>microphone.value));
 const hook=renderHook(()=>useRealtimeTalk(options));
 await act(async()=>hook.result.current.setVoiceMode('expressive'));
 await act(async()=>hook.result.current.start());
 const requests=vi.mocked(fetch).mock.calls;
 const creation=requests.find(([url])=>String(url).endsWith('/buddy/voice/sessions'));
 expect(creation).toBeDefined();expect(JSON.parse(String(creation![1]?.body)).voiceMode).toBe('expressive');
 hook.unmount();
});
