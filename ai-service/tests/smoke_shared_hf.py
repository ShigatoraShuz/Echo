"""Opt-in real shared HF synthetic smoke test; no microphone or account data."""
import sys,time,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.buddy.hf_shared import SharedHF
from app.buddy.process import Process
from app.buddy.config import paths
from app.model.screening import assemble_passes

def main():
 runtime=SharedHF();nano=None
 try:
  start=time.perf_counter();cbt=runtime.acquire('cbt');identity=cbt.call({'check':True});pid=cbt.process.pid
  print(json.dumps({'stage':'ready','seconds':time.perf_counter()-start,'engine':identity['engine'],'pid':pid}),flush=True)
  phq=runtime.acquire('phq8')
  text='This is a synthetic check. Today I worked on an ordinary school assignment.'
  for i in range(1):
   start=time.perf_counter();a=phq.phq_pass(text);b=phq.phq_pass(text,True);v=assemble_passes(a,b)
   print(json.dumps({'stage':'phq','coverage':v['coverage'],'seconds':time.perf_counter()-start,'samePid':phq.process.pid==pid}),flush=True)
   start=time.perf_counter();r=cbt.call({'messages':[{'role':'user','content':'Please give me a numbered list of three practical steps for getting started on my school assignments.'}]})
   print(json.dumps({'stage':'cbt','approved':bool(r.get('reply')) and not r.get('withheld'),'seconds':time.perf_counter()-start,'samePid':cbt.process.pid==pid}),flush=True)
  nano=Process(paths()['nano'],'nano');result=nano.call({'check':True})
  print(json.dumps({'stage':'nano','freeGpuBytes':result['freeGpuBytes']}),flush=True)
  phq.close();print(json.dumps({'stage':'phq_released','cbtRetained':cbt.process.poll() is None}),flush=True)
 except Exception as error:
  code=str(error);print(json.dumps({'stage':'failed','type':type(error).__name__,'code':code if code.startswith(('BUDDY_','NATIVE_')) and len(code)<100 else 'SANITIZED_FAILURE'}),flush=True);raise SystemExit(1)
 finally:
  if nano:nano.close()
  runtime.invalidate()

if __name__=="__main__":main()
