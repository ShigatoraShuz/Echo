"""Explicit real private-IPC startup residency and native Expressive speech check."""
import sys,time,threading,json,base64,re,uuid,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.core.config import Settings
from app.model.text_transport import TextRuntime

def main():
 import numpy as np
 import torch
 from scipy.signal import resample_poly
 from app.buddy.gpu_memory import global_memory
 runtime=None;records=[];errors=[];samples=[];done=threading.Event();success=False
 def record(stage,**fields):
  value={'stage':stage,**fields};records.append(value);print(json.dumps(value),flush=True)
 def watch():
  while not done.wait(.1):
   try:samples.append(global_memory(torch)['freeBytes'])
   except Exception:pass
 threading.Thread(target=watch,daemon=True).start()
 try:
  settings=Settings(app_env='test',host='127.0.0.1',models_root=str(Path('models').resolve()),ai_service_token='synthetic-test-token-not-used-for-http',core_models_enabled=True,core_transport='text_memory',echo_buddy_enabled=True)
  runtime=TextRuntime(settings);assert runtime.metrics()['baseReady'] is False
  start=time.perf_counter()
  def load():
   try:runtime.preload()
   except Exception as e:errors.append(e)
  thread=threading.Thread(target=load);thread.start();polls=0
  while thread.is_alive():runtime.preparation_status();polls+=1;thread.join(.1)
  if errors:raise errors[0]
  metadata=runtime.metrics();pid=metadata['sharedBasePid'];assert metadata['baseReady']
  record('startup_preload',seconds=time.perf_counter()-start,statusPolls=polls)
  session=str(uuid.uuid4());runtime.talk.speech(session,{'task':'unload','preserveStartup':True})
  assert runtime.metrics()['sharedBasePid']==pid;record('page_release_preserves_base')
  start=time.perf_counter();runtime.talk.start(session,voice_mode='expressive');record('expressive_warm',seconds=time.perf_counter()-start)
  phrase='Please place the green pencil on the desk before opening the book.'
  start=time.perf_counter();speech=[];speech_errors=[];pulse_seconds=[]
  def speak():
   try:speech.append(runtime.talk.speech(session,{'task':'speak','texts':[phrase],'voiceMode':'expressive','language':'English'}))
   except Exception as error:speech_errors.append(error)
  speech_thread=threading.Thread(target=speak);speech_thread.start()
  while speech_thread.is_alive():
   pulse_start=time.perf_counter();runtime.talk.require(session);runtime.runtime_status();pulse_seconds.append(time.perf_counter()-pulse_start);speech_thread.join(.25)
  if speech_errors:raise speech_errors[0]
  result=speech[0]
  record('heartbeats_during_native_speech',samples=len(pulse_seconds),maximumSeconds=max(pulse_seconds,default=0))
  audio=result['segments'][0];assert audio['sampleRate']==48000 and audio['channels']==2
  values=np.frombuffer(base64.b64decode(audio['audio']),dtype='<i2').reshape(-1,2).astype(np.float32)/32768
  mono=resample_poly(values.mean(axis=1),1,3);pcm=(np.clip(mono,-1,1)*32767).astype('<i2').tobytes()
  recognized=runtime.talk.speech(session,{'task':'transcribe','audio':base64.b64encode(pcm).decode(),'language':'English'})['text']
  def words(text):return re.findall('[a-z]+',text.lower().replace("i'm",'i am'))
  expected=words(phrase);actual=set(words(recognized));coverage=sum(w in actual for w in expected)/len(expected)
  assert coverage>=.75
  record('native_speech_and_whisper_consistency',seconds=time.perf_counter()-start,durationSeconds=len(values)/48000,recognizedWordCoverage=coverage,voiceReferenceSHA256=result['model']['voiceReferenceSHA256'])
  assert runtime.metrics()['sharedBasePid']==pid
  runtime.talk.stop(session);runtime.talk.speech(session,{'task':'unload','preserveStartup':True})
  assert runtime.metrics()['sharedBasePid']==pid;record('stop_and_page_exit_keep_base')
  runtime.talk.speech(session,{'task':'unload'})
  assert not runtime.metrics()['baseReady'];record('explicit_unload_releases_base')
  assert min(samples)>=2*1024**3
  success=True
 except Exception as error:
  code=str(error);record('failure',type=type(error).__name__,code=code if code.startswith(('BUDDY_','NATIVE_')) and code.replace('_','').isalnum() else 'STARTUP_SPEECH_CHECK_FAILED')
 finally:
  if runtime:runtime.release()
  done.set()
 report={'passed':success,'minimumSampledFreeGpuBytes':min(samples) if samples else None,'measurements':records,'limitations':['synthetic speech only','no browser or physical microphone','ASR consistency is not listening-quality validation']}
 target=Path(os.environ.get('ECHO_TEST_REPORT_DIR','models'))/'startup-expressive-test.json';target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps({'passed':success,'workersReleased':True}),flush=True)
 return 0 if success else 1

if __name__=='__main__':raise SystemExit(main())
