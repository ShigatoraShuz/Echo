"""Single-user loopback service. Run with speech-venv/python.exe -B server.py."""
import json,multiprocessing as mp,queue,secrets,threading,time,uuid
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlparse,parse_qs
from runner import ROOT,check,worker

class Jobs:
    def __init__(self):
        self.lock=threading.RLock();self.jobs={};self.process=None;self.tasks=None;self.replies=None;self.active=None
    def refresh(self):
        if self.replies:
            try:
                while True:
                    job,kind,value=self.replies.get_nowait()
                    if job in self.jobs and self.jobs[job]['status']=='running':
                        self.jobs[job].update({'message':value} if kind=='progress' else value)
                        if kind=='result':self.active=None
            except queue.Empty:pass
        if self.active and self.process and not self.process.is_alive():
            self.jobs[self.active].update(status='failed',error='Inference worker exited unexpectedly. Inspect partial results.');self.active=None
    def start(self,request):
        check(request)
        with self.lock:
            self.refresh()
            if self.active:raise BlockingIOError('Generation is already running.')
            if not self.process or not self.process.is_alive():
                self.tasks,self.replies=mp.Queue(),mp.Queue();self.process=mp.Process(target=worker,args=(self.tasks,self.replies));self.process.start()
            job=uuid.uuid4().hex;self.jobs[job]={'job':job,'status':'running','message':'Preparing inference'};self.active=job;self.tasks.put((job,request))
            return dict(self.jobs[job])
    def stop(self):
        with self.lock:
            self.refresh()
            if self.process and self.process.is_alive():self.process.terminate();self.process.join(10)
            if self.process and self.process.is_alive():self.process.kill();self.process.join(5)
            if self.active:
                self.jobs[self.active].update(status='cancelled',message='Stopped. Partial files are diagnostic only.')
                folder=ROOT/'results'/self.active;folder.mkdir(parents=True,exist_ok=True)
                path=folder/'report.json'
                try:report=json.loads(path.read_text(encoding='utf-8'))
                except (OSError,ValueError):report={}
                report.update(self.jobs[self.active]);path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
            self.active=None;self.process=None
            for q in (self.tasks,self.replies):
                if q:q.close();q.cancel_join_thread()
            self.tasks=self.replies=None

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def send(self,status,data,kind='application/json'):
        if isinstance(data,(dict,list)):data=json.dumps(data,ensure_ascii=False).encode('utf-8')
        self.send_response(status);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; media-src 'self'; frame-ancestors 'none'");self.end_headers();self.wfile.write(data)
    def valid_host(self):return self.headers.get('Host')==f'127.0.0.1:{self.server.server_port}'
    def do_GET(self):
        if not self.valid_host():return self.send(403,{'error':'Invalid local host.'})
        parsed=urlparse(self.path)
        if parsed.path in ('/','/index.html'):
            page=(ROOT/'index.html').read_text(encoding='utf-8').replace('__TOKEN__',self.server.token)
            return self.send(200,page.encode('utf-8'),'text/html; charset=utf-8')
        if parsed.path=='/api/job':
            job=parse_qs(parsed.query).get('id',[''])[0]
            with self.server.jobs.lock:
                self.server.jobs.refresh();result=self.server.jobs.jobs.get(job)
                return self.send(200,result) if result else self.send(404,{'error':'Unknown job.'})
        if parsed.path.startswith('/audio/'):
            job=parsed.path.removeprefix('/audio/')
            with self.server.jobs.lock:
                self.server.jobs.refresh();result=self.server.jobs.jobs.get(job,{})
                if result.get('status')!='complete':return self.send(404,{'error':'Completed audio unavailable.'})
                return self.send(200,(ROOT/'results'/job/'speech.wav').read_bytes(),'audio/wav')
        return self.send(404,{'error':'Not found.'})
    def do_POST(self):
        origin=f'http://127.0.0.1:{self.server.server_port}'
        if not self.valid_host() or self.headers.get('Origin')!=origin or self.headers.get('X-Local-Token')!=self.server.token:return self.send(403,{'error':'Only this local page may submit requests.'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=100000:raise ValueError('Invalid request size.')
            request=json.loads(self.rfile.read(size))
            if not isinstance(request,dict):raise ValueError('Expected a request object.')
            if self.path=='/api/preview':return self.send(200,{'text':check(request)})
            if self.path=='/api/generate':return self.send(202,self.server.jobs.start(request))
            if self.path=='/api/cancel':self.server.jobs.stop();return self.send(200,{'status':'cancelled'})
            return self.send(404,{'error':'Not found.'})
        except BlockingIOError as exc:return self.send(409,{'error':str(exc)})
        except (ValueError,TypeError) as exc:return self.send(400,{'error':str(exc)})
        except Exception as exc:return self.send(500,{'error':str(exc)})

def make_server(port=8765):
    server=ThreadingHTTPServer(('127.0.0.1',port),Handler);server.jobs=Jobs();server.token=secrets.token_urlsafe(32);return server
if __name__=='__main__':
    from buddy import main
    main()
    raise SystemExit(0)
    mp.freeze_support()
    try:server=make_server()
    except OSError as exc:raise SystemExit('Cannot start localhost port 8765. Close the other service and retry. '+str(exc))
    print('Open http://127.0.0.1:8765 in your browser. Press Ctrl+C here to stop.',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.jobs.stop();server.server_close()
