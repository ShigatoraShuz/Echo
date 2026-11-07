"""Explicit maximum-context GPU stress with synthetic inputs and no delivered drafts."""
import sys,json,time,threading,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.buddy.hf_shared import SharedHF
from app.buddy import process as process_module
from app.buddy.process import Process
from app.buddy.config import paths
from app.model.native_process import NativeProcess
from app.model.screening import assemble_passes

def main():
 import torch
 from app.buddy.gpu_memory import global_memory,require_headroom
 runtime=SharedHF();runtime.keep_loaded=True;workers=[];samples=[];records=[];done=threading.Event();success=False
 def monitor():
  while not done.wait(.1):
   try:samples.append(global_memory(torch)['freeBytes'])
   except Exception:pass
 def record(stage,**fields):
  value={'stage':stage,'freeGpuBytes':require_headroom(torch)['freeBytes'],**fields};records.append(value);print(json.dumps(value),flush=True)
 thread=threading.Thread(target=monitor,daemon=True);thread.start()
 original_path=process_module.WORKER_SCRIPT
 try:
  process_module.WORKER_SCRIPT=Path(__file__).with_name('stress_hf_worker.py')
  cbt=runtime.acquire('cbt');cbt.call({'check':True});pid=cbt.process.pid
  process_module.WORKER_SCRIPT=original_path
  record('shared_base_ready')
  cbt.close();assert runtime.worker.process.pid==pid and runtime.worker.process.poll() is None
  cbt=runtime.acquire('cbt');record('startup_pin_survives_page_release',samePid=cbt.process.pid==pid)
  for kind in ('xlmr','e4'):
   worker=NativeProcess(Path('models').resolve(),kind);workers.append(worker);record(kind+'_ready')
  nano=Process(paths()['nano'],'nano');workers.append(nano);nano.call({'check':True});record('nano_ready')
  whisper=Process(paths()['whisper'],'whisper');workers.append(whisper);whisper.call({'check':True});record('whisper_ready')
  # Mirror production admission: journal stages can release temporary GPU weights.
  if global_memory(torch)['freeBytes'] < 6*1024**3:
   workers[1].close();record('e4_released_for_full_context')
  if global_memory(torch)['freeBytes'] < 6*1024**3:
   workers[0].close();record('xlmr_released_for_full_context')
  if global_memory(torch)['freeBytes'] < 6*1024**3:raise RuntimeError('BUDDY_GPU_CAPACITY_WAITING')
  start=time.perf_counter();maximum=cbt.call({'stressContext':True})
  assert maximum['inputTokens']==3196 and maximum['generatedTokens']==900 and maximum['totalTokens']==4096
  record('maximum_4096_context',seconds=time.perf_counter()-start,**{k:v for k,v in maximum.items() if k!='freeGpuBytes'})
  for index,kind in enumerate(('xlmr','e4')):
   if workers[index].process.poll() is not None:
    workers[index]=NativeProcess(Path('models').resolve(),kind);record(kind+'_resumed_after_context')
   worker=workers[index]
   start=time.perf_counter();value=worker.call(('Synthetic ordinary school assignment. '*600)[:20000]);record(kind+'_long_input',seconds=time.perf_counter()-start)
  phq=runtime.acquire('phq8');start=time.perf_counter()
  try:
   text=('This is a synthetic ordinary school assignment. '*600)[:20000]
   adapted=phq.phq_pass(text);checked=phq.phq_pass(text,True);value=assemble_passes(adapted,checked)
   assert value['truncated'] and value['retainedTokens']==1700
   record('phq_max_input',seconds=time.perf_counter()-start,retainedTokens=value['retainedTokens'],truncated=True)
  except Exception as error:
   if str(error)!='NATIVE_PHQ_OUTPUT_INVALID':raise
   record('phq_invalid_draft_withheld',seconds=time.perf_counter()-start)
  # Test an oversized latest user input at the worker policy boundary, then reuse the same model.
  try:cbt.call({'messages':[{'role':'user','content':'x '*10000}]})
  except Exception as error:
   assert str(error)=='BUDDY_CBT_CONTEXT_LIMIT';record('oversized_latest_rejected')
  else:raise AssertionError('Oversized latest turn was not rejected')
  result=cbt.call({'messages':[{'role':'user','content':'Please give me a numbered list of three practical steps for getting started on my school assignments.'}]})
  assert result.get('reply') and not result.get('withheld') and cbt.process.pid==pid
  record('approved_after_adapter_switch_and_limit',samePid=True)
  from app.buddy.sentences import sentences,batches
  parts=sentences('This is a synthetic speech check about an ordinary school assignment. '*20)
  sizes=[];speech_started=time.perf_counter()
  for group in batches(parts):
   target=(len(group)+2)*1024**3
   for index,kind in ((1,'e4'),(0,'xlmr')):
    if global_memory(torch)['freeBytes']<target and workers[index].process.poll() is None:
     workers[index].close();record(kind+'_released_for_speech_batch')
   audio=nano.call({'texts':group});assert len(audio['segments'])==len(group);sizes.append(len(group))
  assert sizes[:2]==[1,1] and all(n<=3 for n in sizes[2:]);record('long_segmented_speech',seconds=time.perf_counter()-speech_started,segments=len(parts),schedule=sizes)
  for index,kind in enumerate(('xlmr','e4')):
   if workers[index].process.poll() is not None:
    workers[index]=NativeProcess(Path('models').resolve(),kind);workers[index].call('Synthetic ordinary school assignment.');record(kind+'_resumed_after_speech')
  assert all(w.process.poll() is None for w in workers)
  assert min(samples)>=2*1024**3
  success=True
 except Exception as error:
  code=str(error);records.append({'stage':'failure','type':type(error).__name__,'code':code if code.startswith(('BUDDY_','NATIVE_')) and code.replace('_','').isalnum() else 'STRESS_FAILED'})
 finally:
  process_module.WORKER_SCRIPT=original_path
  for worker in reversed(workers):worker.close()
  runtime.invalidate();done.set();thread.join(2)
 report={'passed':success,'minimumSampledFreeGpuBytes':min(samples) if samples else None,'samples':len(samples),'measurements':records,'limitations':['synthetic inputs','no physical microphone/camera or human listening','Expressive engine tested separately']}
 target=Path(os.environ.get('ECHO_TEST_REPORT_DIR','models'))/'maximum-context-test.json';target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(report,indent=2),encoding='utf-8')
 print(json.dumps({'passed':success,'minimumSampledFreeGpuBytes':report['minimumSampledFreeGpuBytes'],'workersReleased':True}),flush=True)
 return 0 if success else 1

if __name__=='__main__':raise SystemExit(main())
