import pytest
from types import SimpleNamespace as NS
from app.buddy.hf_shared import SharedHF

class Worker:
 def __init__(self,*args,**kwargs):self.process=NS(poll=lambda:None);self.closed=0;self.requests=[]
 def call(self,request,*args,**kwargs):self.requests.append(request);return request
 def close(self):self.closed+=1

def test_two_roles_reuse_worker_and_last_release_closes(monkeypatch):
 monkeypatch.setattr('app.buddy.hf_shared.Process',Worker)
 runtime=SharedHF();cbt=runtime.acquire('cbt');phq=runtime.acquire('phq8')
 assert cbt.worker is phq.worker
 phq.phq_pass('synthetic',True);assert phq.worker.requests[-1]=={'phqText':'synthetic','phqCheck':True}
 phq.close();assert cbt.worker.closed==0
 cbt.close();assert cbt.worker.closed==1

def test_invalidation_fences_old_handles_from_replacement(monkeypatch):
 monkeypatch.setattr('app.buddy.hf_shared.Process',Worker)
 runtime=SharedHF();old=runtime.acquire('cbt');runtime.invalidate();new=runtime.acquire('cbt')
 with pytest.raises(Exception,match='WORKER_UNAVAILABLE'):old.call({})
 old.close();assert new.worker.closed==0
 assert new.call({'check':True})=={'check':True}
 runtime.invalidate()

def test_invalid_phq_output_does_not_kill_healthy_base(monkeypatch):
 from app.core.exceptions import ModelUnavailableError
 monkeypatch.setattr('app.buddy.hf_shared.Process',Worker)
 runtime=SharedHF();cbt=runtime.acquire('cbt');phq=runtime.acquire('phq8')
 def fail(*args,**kwargs):raise ModelUnavailableError('NATIVE_PHQ_OUTPUT_INVALID')
 phq.worker.call=fail
 with pytest.raises(Exception,match='NATIVE_PHQ_OUTPUT_INVALID'):phq.phq_pass('synthetic')
 assert cbt.ready and cbt.worker.closed==0
 runtime.invalidate()


def test_phq_worker_restores_cbt_even_after_invalid_output(monkeypatch):
 from app.buddy import worker
 from app.model import screening
 calls=[]
 model=NS(set_adapter=lambda name:calls.append(name),eval=lambda:None)
 monkeypatch.setattr(worker,'ENGINE',NS(model=model,phq_tokenizer=object()))
 def fail(*args,**kwargs):raise ValueError('malformed synthetic output')
 monkeypatch.setattr(screening,'infer_pass',fail)
 with pytest.raises(RuntimeError,match='NATIVE_PHQ_OUTPUT_INVALID'):worker.cbt({'phqText':'synthetic','phqCheck':True})
 assert calls==['phq8','cbt']



def test_startup_pin_survives_page_release_and_shutdown_invalidates(monkeypatch):
 monkeypatch.setattr('app.buddy.hf_shared.Process',Worker)
 runtime=SharedHF();runtime.keep_loaded=True
 page=runtime.acquire('cbt');worker=page.worker;page.close()
 assert worker.closed==0 and set(runtime.handles)=={'startup'}
 journal=runtime.acquire('phq8');assert journal.worker is worker
 journal.close();assert worker.closed==0
 runtime.invalidate();assert worker.closed==1
 # A replacement after recovery inherits the startup residency policy.
 page=runtime.acquire('cbt');page.close();assert set(runtime.handles)=={'startup'}
 runtime.invalidate()



def test_full_context_admission_releases_journal_emotion_before_safety(monkeypatch):
 from app.model.core import CoreRuntime
 from app.buddy import gpu_memory
 free=[int(4.5*1024**3)];evicted=[];runtime=CoreRuntime.__new__(CoreRuntime)
 phq=object();runtime.resident={'e4':object(),'xlmr':object(),'phq8':phq}
 def evict(resident,name):evicted.append(name);resident.pop(name);free[0]+=2*1024**3
 runtime._evict_resident=evict
 monkeypatch.setattr(gpu_memory,'global_memory',lambda torch:{'freeBytes':free[0]})
 runtime.ensure_buddy_capacity()
 assert evicted==['e4'] and runtime.resident['phq8'] is phq and 'xlmr' in runtime.resident


def test_capacity_waiting_does_not_evict_shared_base_or_reduce_context(monkeypatch):
 from app.model.core import CoreRuntime
 from app.buddy import gpu_memory
 runtime=CoreRuntime.__new__(CoreRuntime);runtime.resident={'phq8':object()}
 runtime._evict_resident=lambda *args:pytest.fail('shared base must survive')
 monkeypatch.setattr(gpu_memory,'global_memory',lambda torch:{'freeBytes':1024**3})
 with pytest.raises(Exception,match='GPU capacity waiting'):runtime.ensure_buddy_capacity()



def test_explicit_unload_releases_startup_pin(monkeypatch):
 monkeypatch.setattr('app.buddy.hf_shared.Process',Worker)
 runtime=SharedHF();runtime.keep_loaded=True;page=runtime.acquire('cbt');worker=page.worker
 page.close();runtime.disable_startup_residency()
 assert worker.closed==1 and runtime.worker is None and not runtime.keep_loaded
