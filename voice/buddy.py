import json,multiprocessing as mp
from urllib.parse import urlparse,parse_qs
from server import Handler,make_server
from engines import ROOT
from conversation import Conversations
class ConversationHandler(Handler):
    def do_GET(self):
        if not self.valid_host():return self.send(403,{'error':'Invalid host.'})
        path=urlparse(self.path)
        try:
            if path.path in ('/conversation.js','/microphone.js','/buffered.js'):return self.send(200,(ROOT/path.path[1:]).read_bytes(),'application/javascript')
            if path.path=='/api/segment':
                query=parse_qs(path.query);key=query.get('id',[''])[0];index=int(query.get('index',['-1'])[0])
                with self.server.chat.lock:
                    turn=self.server.chat.turns.get(key,{})
                    segments=turn.get('segments',[])
                    if turn.get('status') not in ('running','complete') or not 0<=index<len(segments):return self.send(404,{'error':'Published segment unavailable.'})
                    return self.send(200,(ROOT/'results'/key/f'play-{index:03}.wav').read_bytes(),'audio/wav')
            if path.path=='/api/sessions':
                with self.server.chat.lock:
                    sessions=[self.server.chat.session(p.stem) for p in self.server.chat.folder.glob('*.json')]
                return self.send(200,[{'id':s['id'],'created':s['created'],'title':next((m['content'][:60] for m in s['messages'] if m['role']=='user'),'New conversation')} for s in sorted(sessions,key=lambda s:s['created'],reverse=True)])
            query=parse_qs(path.query)
            if path.path=='/api/session':return self.send(200,self.server.chat.session(query.get('id',[''])[0]))
            if path.path=='/api/turn':
                with self.server.chat.lock:turn=self.server.chat.turns.get(query.get('id',[''])[0])
                return self.send(200,turn) if turn else self.send(404,{'error':'Unknown turn.'})
            return super().do_GET()
        except Exception as exc:return self.send(400,{'error':str(exc)})
    def do_POST(self):
        if self.path=='/api/generate':return self.send(400,{'error':'Use the conversation controls in the Nano copy.'})
        if self.path=='/api/generate' and self.server.chat.active:return self.send(409,{'error':'Interrupt the conversation turn before standalone speech.'})
        if not self.path.startswith('/api/conversation/'):return super().do_POST()
        if not self.valid_host() or self.headers.get('Origin')!=f'http://127.0.0.1:{self.server.server_port}' or self.headers.get('X-Local-Token')!=self.server.token:return self.send(403,{'error':'Only this local page may submit requests.'})
        try:
            size=int(self.headers.get('Content-Length',0))
            if not 0<size<2700000:raise ValueError('Invalid request size.')
            request=json.loads(self.rfile.read(size))
            if not isinstance(request,dict):raise ValueError('Expected an object.')
            route=self.path.rsplit('/',1)[-1]
            if route=='playback':
                with self.server.chat.lock:
                    turn=self.server.chat.turns.get(request.get('turn'))
                    if not turn:raise ValueError('Unknown playback turn.')
                    metrics=request.get('metrics',{})
                    allowed={'firstPlaybackMilliseconds','playbackCompleteMilliseconds','bufferingMilliseconds','status'}
                    if not isinstance(metrics,dict) or set(metrics)-allowed:raise ValueError('Invalid playback metrics.')
                    for k,v in metrics.items():
                        if k=='status':
                            if v not in ('complete','cancelled','failed'):raise ValueError('Invalid playback status.')
                        elif not isinstance(v,(float,int)) or not 0<=v<86400000:raise ValueError('Invalid playback timing.')
                    session=self.server.chat.session(turn['session']);session['events'].append({'turn':turn['id'],'playback':metrics});self.server.chat.save(session)
                return self.send(200,{'status':'recorded'})
            if route=='check':
                result=self.server.chat.preflight();self.server.ready=True;return self.send(200,result)
            if route=='unload':
                if self.server.chat.active:raise ValueError('End the active turn first.')
                self.server.chat.pool.close();self.server.ready=False;return self.send(200,{'status':'unloaded'})
            if route=='cancel':self.server.chat.cancel();return self.send(200,{'status':'cancelled'})
            if route=='new':return self.send(200,self.server.chat.session())
            if route=='turn':
                if not self.server.ready:raise ValueError('Start conversation preflight first.')
                return self.send(202,self.server.chat.start(request))
            return self.send(404,{'error':'Unknown route.'})
        except BlockingIOError as exc:return self.send(409,{'error':str(exc)})
        except Exception as exc:return self.send(400,{'error':str(exc)})
def main():
    mp.freeze_support();server=make_server(8766);server.RequestHandlerClass=ConversationHandler;server.chat=Conversations(server.jobs);server.ready=False
    print('Open http://127.0.0.1:8766 - conversation preflight runs after Start.',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:
        server.chat.pool.close()
        if server.chat.whisper and server.chat.whisper.is_alive():server.chat.whisper.terminate();server.chat.whisper.join(10)
        server.server_close()
if __name__=='__main__':main()
