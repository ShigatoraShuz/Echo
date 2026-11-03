import base64,json,multiprocessing as mp,os,subprocess,threading,time,uuid,queue
from pathlib import Path
import numpy as np
from engines import ROOT
from resident import Pool
from runtime_config import CBT_PYTHON,WHISPER_DIR
def whisper_worker(tasks,replies):
    try:
        from faster_whisper import WhisperModel
        model=WhisperModel(WHISPER_DIR,device='cpu',compute_type='int8',local_files_only=True,cpu_threads=4)
        while True:
            audio,language=tasks.get()
            samples=np.frombuffer(audio,dtype='<i2').astype(np.float32)/32768
            if not len(samples) or np.abs(samples).max()<.005:replies.put({'text':''});continue
            segments,info=model.transcribe(samples,language={'English':'en','Filipino':'tl','Taglish':None}[language],beam_size=5,vad_filter=True,condition_on_previous_text=False)
            replies.put({'text':' '.join(x.text.strip() for x in segments if x.no_speech_prob<.6).strip(),'language':info.language})
    except Exception as exc:replies.put({'error':str(exc)})
class Conversations:
    def __init__(self,jobs):
        self.jobs=jobs;self.lock=threading.RLock();self.active=None;self.turns={};self.process=None;self.speech=None;self.whisper=None;self.stt_in=None;self.stt_out=None
        self.pool=Pool();self.folder=ROOT/'sessions';self.folder.mkdir(exist_ok=True)
    def path(self,sid):
        if not isinstance(sid,str) or len(sid)!=32 or any(c not in '0123456789abcdef' for c in sid):raise ValueError('Invalid conversation ID.')
        return self.folder/(sid+'.json')
    def save(self,session):
        path=self.path(session['id']);temp=path.with_suffix('.tmp');temp.write_text(json.dumps(session,ensure_ascii=False,indent=2),encoding='utf-8');os.replace(temp,path)
    def session(self,sid=None):
        with self.lock:
            if sid:return json.loads(self.path(sid).read_text(encoding='utf-8'))
            s={'id':uuid.uuid4().hex,'created':time.time(),'messages':[],'events':[]};self.save(s);return s
    def cbt(self,request,turn=None):
        if turn is not None and not self.alive(turn):raise RuntimeError('Cancelled')
        return self.pool.call('cbt',request)
    def preflight(self):
        if self.active:raise ValueError('Interrupt the current turn first.')
        return self.pool.load()
    def cancel(self,end=False):
        with self.lock:
            if self.active:
                turn=self.turns[self.active];turn['status']='cancelled'
                session=self.session(turn['session']);session['events'].append({'turn':turn['id'],'status':'cancelled'});self.save(session)
                self.pool.interrupt()
            self.active=None
        if not self.pool.ready:self.pool.load()
    def start(self,request):
        if not self.pool.ready:raise ValueError('Load models first.')
        mode=request.get('segmentMode','buffered')
        if mode not in ('buffered','sentences_2_then_3'):raise ValueError('Invalid speech segment mode.')
        language=request.get('language','English')
        if language!='English' and not request.get('experimental'):raise ValueError('Enable Experimental languages first.')
        if language not in ('English','Filipino','Taglish'):raise ValueError('Invalid language.')
        pcm=None
        if 'audio' in request:
            pcm=base64.b64decode(request['audio'],validate=True)
            if len(pcm)>1920000 or len(pcm)%2:raise ValueError('Recording exceeds 60 seconds or has invalid PCM.')
        elif not request.get('retry') and (not isinstance(request.get('text'),str) or not request['text'].strip() or len(request['text'])>4000):raise ValueError('Enter a message of up to 4000 characters.')
        with self.lock:
            if self.active:raise BlockingIOError('A conversation turn is already running.')
            session=self.session(request.get('session'))
            turn={'id':uuid.uuid4().hex,'session':session['id'],'status':'running','message':'Transcribing' if pcm is not None else 'Thinking','timings':{},'segmentMode':mode}
            self.turns[turn['id']]=turn;self.active=turn['id']
            threading.Thread(target=self.run,args=(turn,request,pcm),daemon=True).start();return dict(turn)
    def alive(self,turn):return self.active==turn['id'] and turn['status']=='running'
    def run(self,turn,request,pcm):
        begin=time.perf_counter()
        try:
            if pcm is not None:
                with self.lock:
                    if not self.alive(turn):return
                    if not self.whisper or not self.whisper.is_alive():
                        self.stt_in,self.stt_out=mp.Queue(),mp.Queue();self.whisper=mp.Process(target=whisper_worker,args=(self.stt_in,self.stt_out));self.whisper.start()
                    incoming,outgoing=self.stt_in,self.stt_out;incoming.put((pcm,request.get('language','English')))
                deadline=time.monotonic()+120
                while True:
                    if not self.alive(turn):return
                    try:result=outgoing.get(timeout=.2);break
                    except queue.Empty:
                        if time.monotonic()>deadline:raise RuntimeError('Whisper timed out.')
                if result.get('error'):raise RuntimeError(result['error'])
                text=result['text'];turn['timings']['transcriptionSeconds']=time.perf_counter()-begin
                if not text:
                    with self.lock:
                        if self.alive(turn):turn['status']='empty';self.active=None
                    return
            else:text=request.get('text','').strip()
            with self.lock:
                if not self.alive(turn):return
                session=self.session(turn['session']);turn['transcript']=text
                if request.get('retry'):
                    candidates=[m for m in session['messages'] if m.get('turn')==request['retry'] and m['role']=='assistant']
                    if not candidates:raise ValueError('No approved reply to retry.')
                    turn['reply']=candidates[-1]['content']
                else:
                    session['messages'].append({'role':'user','content':text,'turn':turn['id']});self.save(session)
                pass  # Keep both GPU workers resident.
            if not request.get('retry'):
                turns=[{'role':m['role'],'content':m['content']} for m in session['messages']][-19:]
                while turns and turns[0]['role']=='assistant':turns.pop(0)
                turn['contextMessagesOmitted']=len(session['messages'])-len(turns)
                turn['message']='Thinking';start=time.perf_counter()
                with self.lock:
                    if not self.alive(turn):return
                result=self.cbt({'messages':turns},turn);turn['timings']['cbtSeconds']=time.perf_counter()-start
                with self.lock:
                    if not self.alive(turn):return
                    turn['modelIdentity']=result.get('modelIdentity');turn['contextTurnsDropped']=result.get('dropped_history_turns',0)
                    if result.get('needs_review') or not result.get('reply'):
                        turn.update(status='withheld',message=result.get('warning','Response withheld for review.'),issues=result.get('issues',[]));self.active=None
                        session['events'].append({'turn':turn['id'],'status':'withheld','issues':turn['issues']});self.save(session);return
                    turn['reply']=result['reply'];session['messages'].append({'role':'assistant','content':turn['reply'],'turn':turn['id'],'modelIdentity':turn['modelIdentity']});self.save(session)
            if not self.alive(turn):return
            turn['message']='Preparing Nano speech'
            def publish(info):
                with self.lock:
                    if not self.alive(turn):return
                    expected=len(turn.setdefault('segments',[]))
                    if info['index']<expected:return
                    if info['index']!=expected:raise ValueError('Segment sequence mismatch.')
                    turn['segments'].append(dict(info,url='/api/segment?id='+turn['id']+'&index='+str(info['index'])))
                    if expected==0:turn['timings']['firstSegmentReadySeconds']=time.perf_counter()-begin
            value=self.pool.call('nano',{'text':turn['reply'],'language':request.get('language','English'),'job':turn['id'],'segmentMode':request.get('segmentMode','buffered')},on_segment=publish)
            with self.lock:
                if not self.alive(turn):return
                if value['status']!='complete':raise RuntimeError(value.get('error','Speech failed.'))
                turn.update(status='complete',speech=value);self.active=None
                self.jobs.jobs[turn['id']]=value
                session=self.session(turn['session']);session['events'].append({'turn':turn['id'],'status':'complete','voiceReference':value.get('voiceReference'),'timings':turn['timings']});self.save(session)
        except Exception as exc:
            with self.lock:
                if self.alive(turn):
                    if self.speech and self.speech.is_alive():self.speech.terminate();self.speech.join(10)
                    turn.update(status='failed',error=str(exc));self.active=None
                    session=self.session(turn['session']);session['events'].append({'turn':turn['id'],'status':'failed','error':str(exc)});self.save(session)
        finally:turn['timings']['totalSeconds']=time.perf_counter()-begin
