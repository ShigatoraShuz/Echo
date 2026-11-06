"""Isolate native Expressive speech from shared-CBT startup; synthetic audio only."""
import base64,json,os,re,sys,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.buddy.process import Process
from app.buddy.config import paths

def main():
 import numpy as np
 from scipy.signal import resample_poly
 workers=[];measurements=[];passed=False
 def record(stage,**values):
  row={'stage':stage,**values};measurements.append(row);print(json.dumps(row),flush=True)
 try:
  started=time.perf_counter();moss=Process(paths()['moss'],'moss');workers.append(moss)
  prepared=moss.call({'check':True});record('native_ready',seconds=time.perf_counter()-started,freeGpuBytes=prepared['freeGpuBytes'])
  phrase='Please place the green pencil on the desk before opening the book.'
  started=time.perf_counter();result=moss.call({'texts':[phrase],'language':'English'})
  segment=result['segments'][0];assert segment['sampleRate']==48000 and segment['channels']==2
  raw=base64.b64decode(segment['audio'],validate=True);assert raw and len(raw)%4==0
  wave=np.frombuffer(raw,dtype='<i2').reshape(-1,2).astype(np.float32)/32768
  record('native_speech',seconds=time.perf_counter()-started,durationSeconds=len(wave)/48000,freeGpuBytes=result['freeGpuBytes'],voiceReferenceSHA256=result['model']['voiceReferenceSHA256'])
  whisper=Process(paths()['whisper'],'whisper');workers.append(whisper);whisper.call({'check':True})
  mono=resample_poly(wave.mean(axis=1),1,3);pcm=(np.clip(mono,-1,1)*32767).astype('<i2').tobytes()
  transcript=whisper.call({'audio':base64.b64encode(pcm).decode(),'language':'English'})['text']
  expected=re.findall('[a-z]+',phrase.lower());actual=set(re.findall('[a-z]+',transcript.lower()))
  coverage=sum(word in actual for word in expected)/len(expected);record('synthetic_asr_consistency',coverage=coverage)
  assert coverage>=.75;passed=True
 except Exception as error:
  code=str(error);record('failure',exceptionType=type(error).__name__,code=code if re.fullmatch(r'BUDDY_[A-Z0-9_]{1,70}',code) else 'NATIVE_SPEECH_CHECK_FAILED')
 finally:
  for worker in reversed(workers):worker.close()
 report={'passed':passed,'measurements':measurements,'limitations':['isolated speech worker only','no shared-CBT transport acceptance','synthetic ASR is not listening review','no physical microphone or browser']}
 target=Path(os.environ['ECHO_TEST_REPORT_DIR'])/'native-expressive-test.json';target.write_text(json.dumps(report,indent=2),encoding='utf-8')
 print(json.dumps({'passed':passed,'workersReleased':True}),flush=True);return 0 if passed else 1

if __name__=='__main__':raise SystemExit(main())
