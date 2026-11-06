"""Explicit synthetic GPU co-residency test. Run from Echo; never starts the app."""
import sys,json,time,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.buddy.hf_shared import SharedHF
from app.buddy.process import Process
from app.buddy.config import paths
from app.model.native_process import NativeProcess
from app.model.screening import assemble_passes


def main():
 import torch
 from app.buddy.gpu_memory import require_headroom
 runtime=SharedHF();workers=[];records=[];success=False
 def record(stage,**fields):
  memory=require_headroom(torch)
  value={'stage':stage,'freeGpuBytes':memory['freeBytes'],**fields};records.append(value);print(json.dumps(value),flush=True)
 try:
  cbt=runtime.acquire('cbt');start=time.perf_counter();cbt.call({'check':True});pid=cbt.process.pid
  record('seallms_ready',seconds=time.perf_counter()-start)
  for kind in ('xlmr','e4'):
   start=time.perf_counter();worker=NativeProcess(Path('models').resolve(),kind);workers.append(worker)
   record(kind+'_loaded',seconds=time.perf_counter()-start)
  nano=Process(paths()['nano'],'nano');workers.append(nano);start=time.perf_counter();nano.call({'check':True});record('nano_codec_ready',seconds=time.perf_counter()-start)
  whisper=Process(paths()['whisper'],'whisper');workers.append(whisper);whisper.call({'check':True});record('whisper_cpu_ready')
  text='This is a synthetic check. Today I worked on an ordinary school assignment.'
  for kind,worker in zip(('xlmr','e4'),workers[:2]):
   start=time.perf_counter();value=worker.call(text)
   if kind=='e4':assert len(value['plutchik_8'])==8
   record(kind+'_inference',seconds=time.perf_counter()-start)
  phq=runtime.acquire('phq8');start=time.perf_counter()
  value=assemble_passes(phq.phq_pass(text),phq.phq_pass(text,True));assert value['coverage']==0
  record('phq_inference',seconds=time.perf_counter()-start,coverage=value['coverage'])
  start=time.perf_counter();value=cbt.call({'messages':[{'role':'user','content':'Please give me a numbered list of three practical steps for getting started on my school assignments.'}]})
  assert value.get('reply') and not value.get('withheld');assert cbt.process.pid==pid
  record('cbt_approved',seconds=time.perf_counter()-start,sameSharedPid=True)
  start=time.perf_counter();audio=nano.call({'texts':['This is a synthetic speech check.']});assert len(audio['segments'])==1
  record('nano_synthesis',seconds=time.perf_counter()-start)
  assert all(worker.process.poll() is None for worker in workers)
  success=True
 except Exception as error:
  code=str(error);records.append({'stage':'failure','exceptionType':type(error).__name__,'code':code if code.startswith(('BUDDY_','NATIVE_')) and code.replace('_','').isalnum() else 'TEST_FAILED'})
 finally:
  for worker in reversed(workers):worker.close()
  runtime.invalidate()
 report={'passed':success,'minimumFreeGpuBytes':min((v['freeGpuBytes'] for v in records if 'freeGpuBytes' in v),default=None),'measurements':records,'limitations':['synthetic inputs','no authenticated browser','no physical microphone or camera','face estimator not loaded','no maximum-context stress or listening review']}
 target=Path(os.environ.get('ECHO_TEST_REPORT_DIR','models'))/'stack-residency-test.json';target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(report,indent=2),encoding='utf-8')
 print(json.dumps({'passed':success,'minimumFreeGpuBytes':report['minimumFreeGpuBytes'],'workersReleased':True}),flush=True)
 return 0 if success else 1

if __name__=='__main__':raise SystemExit(main())
