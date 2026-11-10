"""Explicit synthetic Talk latency probe; run without another GPU service."""
import base64,json,os,sys,time,uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.core.config import Settings
from app.model.text_transport import TextRuntime

class HttpRuntime:
 def __init__(self):
  import urllib.request
  self.url=os.environ['ECHO_BENCH_URL'];self.session=None;self.talk=self
  if self.url!='http://127.0.0.1:8002':raise ValueError('Use the existing loopback model service only')
  config=json.loads(Path('backend/.local-development/native-runtime.json').read_text(encoding='utf-8-sig'))
  self.token=config['serviceToken']
 def preload(self):
  import urllib.request
  deadline=time.monotonic()+600
  while time.monotonic()<deadline:
   try:
    with urllib.request.urlopen(self.url+'/ready',timeout=3) as response:
     if response.status==200:return
   except OSError:pass
   time.sleep(1)
  raise RuntimeError('Running server did not become ready')
 def speech(self,session,payload):
  import urllib.request
  request=urllib.request.Request(self.url+'/v1/talk',data=json.dumps({'sessionId':session,**payload}).encode(),headers={'Authorization':'Bearer '+self.token,'Content-Type':'application/json'})
  with urllib.request.urlopen(request,timeout=600) as response:return json.load(response)
 def start(self,session):
  self.session=session
  return self.speech(session,{'task':'warm'})
 def chat(self,session,messages,delivery_mode='chat'):
  return self.speech(session,{'task':'chat','messages':messages,'deliveryMode':delivery_mode})
 def release(self):
  if self.session:self.speech(self.session,{'task':'close'})


def main():
 import numpy as np
 from scipy.signal import resample_poly
 runtime=None;rows=[]
 try:
  runtime=HttpRuntime() if os.environ.get('ECHO_BENCH_URL') else TextRuntime(Settings(app_env='test',host='127.0.0.1',models_root=os.environ['MODELS_ROOT'],ai_service_token='synthetic-test-token-not-used-for-http',core_models_enabled=True,core_transport='text_memory',echo_buddy_enabled=True))
  runtime.preload();session=str(uuid.uuid4());warm=time.perf_counter();runtime.talk.start(session)
  print(json.dumps({'stage':'warm','seconds':time.perf_counter()-warm}),flush=True)
  for phrase in ['I feel overwhelmed by my schoolwork today and I want to talk about it.', 'Can you give me three practical steps to start my school assignment?']:
   source=runtime.talk.speech(session,{'task':'speak','texts':[phrase],'language':'English'})['segments'][0]
   wave=np.frombuffer(base64.b64decode(source['audio']),dtype='<i2').reshape(-1,2).astype(np.float32)/32768
   mono=resample_poly(wave.mean(axis=1),1,3);pcm=(np.clip(mono,-1,1)*32767).astype('<i2').tobytes()
   start=time.perf_counter()
   transcript=runtime.talk.speech(session,{'task':'transcribe','audio':base64.b64encode(pcm).decode(),'language':'English'})
   stt=time.perf_counter()-start
   turn=time.perf_counter();reply=runtime.talk.chat(session,[{'role':'user','content':phrase}],delivery_mode=os.environ.get('ECHO_BENCH_DELIVERY','chat'))
   generation=time.perf_counter()-turn
   assert reply.get('reply') and not reply.get('supportRequired')
   print(json.dumps({'stage':'approved_reply','input':phrase,'reply':reply['reply']}),flush=True)
   from app.buddy.text_audio import prepare as check_prepare
   check_prepare(reply['reply'],'English',spoken=os.environ.get('ECHO_BENCH_DELIVERY')=='voice')
   prepare=time.perf_counter();parts=runtime.talk.speech(session,{'task':'prepare','text':reply['reply'],'language':'English','speechMode':'sentences_2_then_3','deliveryMode':os.environ.get('ECHO_BENCH_DELIVERY','chat')})
   preparation=time.perf_counter()-prepare
   tts=time.perf_counter();audio=runtime.talk.speech(session,{'task':'speak','texts':parts['groups'][0],'language':'English'})
   synthesis=time.perf_counter()-tts
   row={'input':phrase,'transcript':transcript['text'],'sttSeconds':stt,'generationSeconds':generation,'prepareSeconds':preparation,'firstSynthesisSeconds':synthesis,'processingToFirstAudioSeconds':time.perf_counter()-start,'words':len(reply['reply'].split()),'reply':reply['reply'],'quality':reply.get('quality'),'firstAudioBytes':len(base64.b64decode(audio['segments'][0]['audio']))}
   import re
   if 'three practical steps' in phrase:assert len(re.findall(r'(?<!\S)\d+[.)]\s+\S',reply['reply']))==3
   all_segments=list(audio['segments'])
   for group in parts['groups'][1:]:
    all_segments.extend(runtime.talk.speech(session,{'task':'speak','texts':group,'language':'English'})['segments'])
   waves=[]
   for segment in all_segments:
    samples=np.frombuffer(base64.b64decode(segment['audio']),dtype='<i2').reshape(-1,2).astype(np.float32)/32768
    waves.append(resample_poly(samples.mean(axis=1),1,3))
   spoken=[]
   for samples in waves:
    encoded=base64.b64encode((np.clip(samples,-1,1)*32767).astype('<i2').tobytes()).decode()
    spoken.append(runtime.talk.speech(session,{'task':'transcribe','audio':encoded,'language':'English'})['text'])
   row['spokenTranscript']=' '.join(spoken)
   expected=set(re.findall(r'[a-z]+',parts['preparedText'].lower()));actual=set(re.findall(r'[a-z]+',row['spokenTranscript'].lower()))
   row['spokenWordCoverage']=len(expected & actual)/max(1,len(expected))
   row['completeTextCoverage']=''.join(t for group in parts['groups'] for t in group)==parts['preparedText']
   assert row['completeTextCoverage'] and row['spokenWordCoverage']>=.8,row
   rows.append(row);print(json.dumps(row),flush=True)
 finally:
  if runtime:runtime.release()
 Path(os.environ['ECHO_BENCH_REPORT']).write_text(json.dumps({'turns':rows,'limitations':['synthetic input, no physical microphone','excludes browser endpointing, network, authorization and persistence']},indent=2),encoding='utf-8')
 return 0
if __name__=='__main__':raise SystemExit(main())
