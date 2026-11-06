"""Opt-in real-GPU qualification using synthetic fixtures; never activates a profile.
Run from Echo: .venv-core/python tests/smoke_shared_seallms.py --run-models --with-speech
"""
import argparse
import hashlib
import json
import sys
import time
from pathlib import Path
from types import SimpleNamespace
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'ai-service'))
from app.buddy.shared_seallms import SharedRuntime,REQUIRED_CHECKS,implementation_identity
from app.buddy.process import Process
from app.buddy.config import paths
from app.model.native_process import NativeProcess
from app.model.screening import assemble_passes

TEXT='This is a synthetic check. Today I worked on an ordinary school assignment.'
QUESTION='Please give me a numbered list of three practical steps for getting started on my school assignments.'


def qualify(with_speech=False):
 import torch
 from app.buddy.gpu_memory import global_memory
 core=SimpleNamespace(root=ROOT/'models',resident={},buddy=SimpleNamespace(workers={},ready=False))
 runtime=SharedRuntime(core);clients=[];records=[];checks=dict.fromkeys(REQUIRED_CHECKS,False)
 shared_items=None
 def record(stage,**data):
  value={'stage':stage,**data};records.append(value);print(json.dumps(value),flush=True)
 try:
  started=time.perf_counter();cap=runtime.capability();pid=cap['pid']
  record('shared_ready',seconds=time.perf_counter()-started,pid=pid)
  # Compare the same neutral prompt before and after both adapter selections.
  fingerprints=[]
  for role in ('base','cbt','phq','base'):
   result=runtime.model.view(role).json('POST','/completion',{'prompt':[151644,872,198,9707,13,151645,198,151644,77091,198],
       'n_predict':1,'temperature':0,'top_k':0,'top_p':1,'min_p':0,'return_tokens':True,'n_probs':5})
   fingerprint=hashlib.sha256(json.dumps({'tokens':result.get('tokens'),'probabilities':result.get('completion_probabilities')},sort_keys=True).encode()).hexdigest()
   fingerprints.append(fingerprint)
   expected=runtime.model.view(role).adapter_scales()
   assert result['generation_settings']['lora']==expected
  checks['adapter_isolation']=fingerprints[0]==fingerprints[-1] and len(set(fingerprints))>=2
  started=time.perf_counter();cbt=Process(paths()['cbt'],'cbt');clients.append(cbt);core.buddy.workers['cbt']=cbt
  cbt.call({'check':True,'shared':cap});record('configured_cbt_ready',seconds=time.perf_counter()-started)
  approved=[]
  for index in range(2):
   started=time.perf_counter();result=cbt.call({'messages':[{'role':'user','content':QUESTION}],'shared':runtime.capability()})
   approved.append(bool(result.get('reply')) and not result.get('withheld'))
   record('cbt_turn',index=index,seconds=time.perf_counter()-started,approved=approved[-1],sameBase=runtime.model.server.process.pid==pid)
   if index==0:
    started=time.perf_counter();phq=NativeProcess(core.root,'phq8',shared=runtime.capability());clients.append(phq);core.resident['phq8']=phq
    record('phq_proxy_ready',seconds=time.perf_counter()-started)
    started=time.perf_counter();adapted=phq.phq_pass(TEXT);runtime.capability();checked=phq.phq_pass(TEXT,True)
    result=assemble_passes(adapted,checked);shared_items=result['items']
    record('phq_pair',seconds=time.perf_counter()-started,coverage=result['coverage'],sameBase=runtime.model.server.process.pid==pid)
  checks['cbt_approval']=all(approved);checks['single_base_workers']=runtime.model.server.process.pid==pid
  if with_speech:
   for name in ('whisper','nano'):
    started=time.perf_counter();client=Process(paths()[name],name);clients.append(client)
    client.call({'check':True});record(name+'_ready',seconds=time.perf_counter()-started)
    if name=='nano':
     started=time.perf_counter();audio=client.call({'texts':['This is a synthetic speech check.']})
     record('nano_synthesis',seconds=time.perf_counter()-started,segments=len(audio['segments']))
    evidence=client.call({'stats':True})
    if name=='whisper':
     record('whisper_device',device=evidence['device'],computeType=evidence['computeType'])
     assert evidence['device']=='cpu' and evidence['computeType'] in ('int8','int8_float32')
    else:assert all(values==['cuda:0'] for values in evidence['parameterDevices'].values()) and evidence['referenceDevice']=='cuda:0'
   checks['nano_whisper_residency']=True
  free=global_memory(torch)['freeBytes'];checks['two_gib_headroom']=free>=2*1024**3
  record('gpu_headroom',freeBytes=free,includesSpeech=with_speech)
 except Exception as error:
  code=str(error)
  safe=code if code.startswith(('BUDDY_','NATIVE_')) and code.replace('_','').isalnum() and len(code)<80 else 'QUALIFICATION_FAILED'
  record('failure',exceptionType=type(error).__name__,code=safe)
 finally:
  for client in clients:client.close()
  runtime.close()
 # Compare supported nullable values against the unchanged native policy on the same fixture.
 baseline=None
 try:
  baseline=NativeProcess(core.root,'phq8');result=baseline.call(TEXT)
  checks['phq_nullable_agreement']=shared_items is not None and shared_items==result['items'] and result['coverage']==0
  record('native_phq_comparison',baselineCoverage=result['coverage'],matches=checks['phq_nullable_agreement'])
 finally:
  if baseline:baseline.close()
 lock=json.loads((ROOT/'ai-service/app/buddy/shared-seallms.lock.json').read_text())
 return {'schemaVersion':1,'passed':all(checks.values()),'manifestSHA256':lock['manifestSHA256'],
         'implementationSHA256':implementation_identity(),'checks':checks,'measurements':records,
         'notValidated':['authenticated browser','physical microphone','listening quality','maximum-context stress','cancellation recovery']}


def main():
 parser=argparse.ArgumentParser();parser.add_argument('--run-models',action='store_true');parser.add_argument('--with-speech',action='store_true');args=parser.parse_args()
 if not args.run_models:parser.error('Real GPU qualification requires --run-models; normal unit tests never load weights')
 report=qualify(args.with_speech)
 import importlib.util
 spec=importlib.util.spec_from_file_location('selection',ROOT/'scripts/select-shared-seallms.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 module.atomic_json(ROOT/'models/llama/shared-diagnostic.json',report)
 print(json.dumps({'stage':'qualification_complete','passed':report['passed'],'checks':report['checks'],'selected':False}),flush=True)
 return 0 if report['passed'] else 2

if __name__=='__main__':raise SystemExit(main())
