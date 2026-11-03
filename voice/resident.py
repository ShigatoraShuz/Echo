import json,subprocess,threading,queue,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parent
def verify_assets():
    from checkpoints import validate_checkpoint
    for name in ('nano','codec'):validate_checkpoint(ROOT/'models'/name)
    manifest=ROOT/'setup-manifest.json'
    if not manifest.is_file():raise RuntimeError('Nano setup is incomplete. Run setup_nano.py under your Windows account.')
    import hashlib
    inventory=json.loads(manifest.read_text())
    if not inventory.get('files'):raise RuntimeError('Nano asset verification has not completed.')
    for name,digest in inventory['files'].items():
        path=(ROOT/name).resolve()
        if not path.is_relative_to(ROOT.resolve()) or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=digest:raise RuntimeError('Nano setup integrity failure: '+name)
class Worker:
    def __init__(self,python,kind):
        (ROOT/'logs').mkdir(exist_ok=True);self.log=(ROOT/'logs'/(kind+'.log')).open('a',encoding='utf-8')
        self.process=subprocess.Popen([str(python),'-u','-B',str(ROOT/'resident_worker.py'),kind],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=self.log,text=True,encoding='utf-8',creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0));self.replies=queue.Queue()
        def read():
            for line in self.process.stdout:
                try:self.replies.put(json.loads(line))
                except ValueError:continue
            self.replies.put({'error':'Worker exited. See logs/'+kind+'.log'})
        threading.Thread(target=read,daemon=True).start()
    def call(self,payload,on_segment=None):
        key=uuid.uuid4().hex;self.process.stdin.write(json.dumps({'id':key,'request':payload})+'\n');self.process.stdin.flush();deadline=time.monotonic()+600
        while time.monotonic()<deadline:
            try:r=self.replies.get(timeout=.2)
            except queue.Empty:continue
            if r.get('id') not in (key,None):continue
            if r.get('event')=='segment_ready':
                if on_segment:on_segment(r['segment'])
                continue
            if r.get('error'):raise RuntimeError(r['error'])
            return r['result']
        raise TimeoutError('Resident worker timed out.')
    def close(self):
        if self.process.poll() is None:self.process.kill();self.process.wait()
        self.log.close()
class Pool:
    def __init__(self):self.workers={};self.ready=False;self.serial=threading.RLock();self.active=None;self.metrics={}
    def close(self):
        self.ready=False
        for w in list(self.workers.values()):w.close()
        self.workers.clear()
    def interrupt(self):
        self.ready=False
        if self.active in self.workers:self.workers[self.active].close()
    def load(self):
        with self.serial:
            if self.ready and all(w.process.poll() is None for w in self.workers.values()):return self.metrics
            self.close();start=time.perf_counter()
            try:
                verify_assets()
                paths={'cbt':Path(__import__('runtime_config').CBT_PYTHON),'nano':ROOT/'.venv-nano/Scripts/python.exe'}
                for kind in ('cbt','nano'):
                    if not paths[kind].is_file():raise FileNotFoundError('Missing environment: '+str(paths[kind]))
                    self.workers[kind]=Worker(paths[kind],kind);self.workers[kind].call({'check':True})
                warm=self.workers['cbt'].call({'messages':[{'role':'user','content':'I feel overwhelmed by schoolwork.'}]})
                nano=self.workers['nano'].call({'text':'You can take one slow breath.','language':'English','job':uuid.uuid4().hex})
                if nano['freeGPUBytes']<2*1024**3:raise RuntimeError('Less than 2 GiB GPU headroom after combined warm-up.')
                self.metrics={'loadAndWarmSeconds':time.perf_counter()-start,'freeGPUBytes':nano['freeGPUBytes'],'workers':{k:w.process.pid for k,w in self.workers.items()},'coResidency':'warm-up verified; stress/listening tests still required'};self.ready=True;return self.metrics
            except Exception:self.close();raise
    def call(self,kind,payload,on_segment=None):
        with self.serial:
            if not self.ready:raise RuntimeError('Models not ready. Load models again.')
            self.active=kind
            try:return self.workers[kind].call(payload,on_segment=on_segment) if on_segment else self.workers[kind].call(payload)
            except Exception:self.close();raise
            finally:self.active=None
