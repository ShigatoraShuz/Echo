import {afterEach,expect,it,vi} from 'vitest';
import {browserSpeechSupported,startBrowserSpeech} from './browser-speech';
class Recognition{
 static current:Recognition;
 onstart:any;onend:any;onerror:any;onresult:any;
 lang='';continuous=false;interimResults=false;maxAlternatives=0;
 constructor(){Recognition.current=this;}
 start=vi.fn(()=>this.onstart?.());stop=vi.fn();abort=vi.fn();
 result(text:string,final=true,index=0){const results:any[]=[];results[index]={isFinal:final,0:{transcript:text}};this.onresult?.({resultIndex:index,results});}
}
function setup(){vi.stubGlobal('SpeechRecognition',Recognition);const onFinal=vi.fn(),onError=vi.fn(),onInterim=vi.fn();const capture=startBrowserSpeech({onFinal,onError,onInterim});return {capture,recognition:Recognition.current,onFinal,onError,onInterim};}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('detects prefixed support and clearly rejects unsupported browsers',()=>{
 vi.stubGlobal('SpeechRecognition',undefined);vi.stubGlobal('webkitSpeechRecognition',undefined);expect(browserSpeechSupported()).toBe(false);expect(()=>startBrowserSpeech({onFinal:vi.fn(),onError:vi.fn()})).toThrow('Choose Whisper');vi.stubGlobal('webkitSpeechRecognition',Recognition);expect(browserSpeechSupported()).toBe(true);
});
it('keeps interim text separate and emits each finalized result once on end',()=>{
 const f=setup();f.recognition.result('draft',false);expect(f.onFinal).not.toHaveBeenCalled();f.recognition.result('First.');f.recognition.result('First.');f.recognition.result('Second.',true,1);f.recognition.onend();expect(f.onFinal).toHaveBeenCalledExactlyOnceWith('First. Second.');expect(f.onError).not.toHaveBeenCalled();expect(f.recognition.onresult).toBeNull();
});
it('ignores late results after cancellation and releases recognition',()=>{
 const f=setup(),late=f.recognition.onresult,end=f.recognition.onend;f.capture.cancel();late({resultIndex:0,results:[{isFinal:true,0:{transcript:'stale'}}]});end();expect(f.recognition.abort).toHaveBeenCalledOnce();expect(f.onFinal).not.toHaveBeenCalled();expect(f.onError).not.toHaveBeenCalled();
});
it.each(['not-allowed','network','no-speech','audio-capture'])('reports %s without restarting',error=>{
 const f=setup();f.recognition.onerror({error});expect(f.onError).toHaveBeenCalledTimes(1);expect(f.recognition.start).toHaveBeenCalledTimes(1);expect(f.onFinal).not.toHaveBeenCalled();
});
it('stops at 59 seconds and waits for the final result',()=>{
 vi.useFakeTimers();const f=setup();vi.advanceTimersByTime(59000);expect(f.recognition.stop).toHaveBeenCalledOnce();f.recognition.result('Complete sentence.');f.recognition.onend();vi.advanceTimersByTime(6000);expect(f.onFinal).toHaveBeenCalledExactlyOnceWith('Complete sentence.');expect(f.onError).not.toHaveBeenCalled();
});
it('times out a browser that never finishes and rejects overlong transcripts',()=>{
 vi.useFakeTimers();const f=setup();f.capture.stop();vi.advanceTimersByTime(5000);expect(f.onError).toHaveBeenCalledWith(expect.stringContaining('did not finish'));
 const g=setup();g.recognition.result('x'.repeat(4001));expect(g.onFinal).not.toHaveBeenCalled();expect(g.onError).toHaveBeenCalledWith(expect.stringContaining('4,000'));
});
