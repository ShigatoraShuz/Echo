import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {JournalDictationControl} from './journal-dictation-control';
vi.mock('@/infrastructure/api/supabase-auth-token-provider',()=>({supabaseAuthTokenProvider:{getAccessToken:async()=>'synthetic-token'}}));
vi.mock('@/config/environment',()=>({env:{apiBaseUrl:'http://localhost/api/v1'}}));
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it('uses browser speech without uploading audio and appends to the latest draft',async()=>{
 const {fetcher}=setup();let recognition:any;
 vi.stubGlobal('SpeechRecognition',class{onstart:any;onend:any;onresult:any;onerror:any;constructor(){recognition=this;}start(){this.onstart?.();}stop(){this.onend?.();}abort(){}});
 const change=vi.fn(),view=render(<JournalDictationControl body="Draft" onChange={change} identity="entry"/>);
 fireEvent.change(screen.getByRole('combobox',{name:'Speech recognition'}),{target:{value:'browser'}});
 expect(screen.getByText(/browser’s speech service/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Dictate'}));await screen.findByRole('button',{name:'Stop and transcribe'});expect(screen.getByRole('combobox')).toBeDisabled();
 view.rerender(<JournalDictationControl body="Draft plus typing" onChange={change} identity="entry"/>);
 act(()=>recognition.onresult({resultIndex:0,results:[{isFinal:true,0:{transcript:'Browser dictation.'}}]}));fireEvent.click(screen.getByRole('button',{name:'Stop and transcribe'}));
 expect(change).toHaveBeenCalledExactlyOnceWith('Draft plus typing\n\nBrowser dictation.');expect(fetcher).not.toHaveBeenCalled();expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();view.unmount();
});
function setup(text='A dictated reflection.'){
 const stop=vi.fn();vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn(async()=>({getTracks:()=>[{stop}]}))},clipboard:{writeText:vi.fn(async()=>{})}});
 class Recorder {state='inactive';mimeType='audio/webm';ondataavailable:any;onstop:any;onerror:any;start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['audio'])});this.onstop?.();}}
 vi.stubGlobal('MediaRecorder',Recorder);let submitted=false;
 const id='10000000-0000-4000-8000-000000000001';
 const fetcher=vi.fn(async(url:string,options?:RequestInit)=>{
  if(options?.method==='DELETE')return new Response(null,{status:204});
  if(url.endsWith('/audio')){submitted=true;return Response.json({data:{id,state:'working'}});}
  if(url.endsWith('/result'))return Response.json({data:{text}});
  return Response.json({data:{id,state:options?.method==='POST'?'preparing':submitted?'complete':'prepared'}});
 });vi.stubGlobal('fetch',fetcher);return {fetcher,stop};
}
it('appends the transcript to the latest body and releases the microphone/job',async()=>{
 const {fetcher,stop}=setup(),change=vi.fn(),busy=vi.fn();
 const view=render(<JournalDictationControl body="Original" onChange={change} identity="entry" onBusyChange={busy}/>);
 fireEvent.click(screen.getByRole('button',{name:'Dictate'}));await screen.findByRole('button',{name:'Stop and transcribe'});
 view.rerender(<JournalDictationControl body="Original plus typing" onChange={change} identity="entry" onBusyChange={busy}/>);
 fireEvent.click(screen.getByRole('button',{name:'Stop and transcribe'}));
 await waitFor(()=>expect(change).toHaveBeenCalledWith('Original plus typing\n\nA dictated reflection.'));
 expect(stop).toHaveBeenCalled();expect(fetcher.mock.calls.some(([,o])=>o?.method==='DELETE')).toBe(true);expect(busy).toHaveBeenLastCalledWith(false);view.unmount();
});
it('cancels recording on entry changes without appending late content',async()=>{
 const {fetcher,stop}=setup(),change=vi.fn();const view=render(<JournalDictationControl body="First" onChange={change} identity="first"/>);
 fireEvent.click(screen.getByRole('button',{name:'Dictate'}));await screen.findByRole('button',{name:'Stop and transcribe'});
 view.rerender(<JournalDictationControl body="Second" onChange={change} identity="second"/>);
 expect(stop).toHaveBeenCalled();expect(change).not.toHaveBeenCalled();expect(fetcher.mock.calls.some(([u])=>u.endsWith('/audio'))).toBe(false);view.unmount();
});
it('preserves writing and offers the transcript when it exceeds the body limit',async()=>{
 setup('Too much text');const change=vi.fn();const view=render(<JournalDictationControl body={'a'.repeat(9999)} onChange={change} identity="entry"/>);
 fireEvent.click(screen.getByRole('button',{name:'Dictate'}));await screen.findByRole('button',{name:'Stop and transcribe'});fireEvent.click(screen.getByRole('button',{name:'Stop and transcribe'}));
 await screen.findByRole('button',{name:'Copy transcript'});expect(change).not.toHaveBeenCalled();expect(screen.getByRole('textbox')).toHaveValue('Too much text');view.unmount();
});
it('reports denied microphone permission without sending audio',async()=>{
 const {fetcher}=setup();vi.spyOn(navigator.mediaDevices,'getUserMedia').mockRejectedValue(new DOMException('Denied','NotAllowedError'));
 const view=render(<JournalDictationControl body="Writing" onChange={vi.fn()} identity="entry"/>);fireEvent.click(screen.getByRole('button',{name:'Dictate'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('permission was denied');expect(fetcher).not.toHaveBeenCalled();view.unmount();
});
