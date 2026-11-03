"""Checks request parsing in memory: no localhost connection required."""
import io,json,time,types,unittest
from test_local import TextTests
from server import Handler,Jobs
class Connection:
    def __init__(self,request):self.input=io.BytesIO(request);self.output=bytearray()
    def makefile(self,*args,**kwargs):return self.input
    def sendall(self,data):self.output.extend(data)
class ProtocolTests(unittest.TestCase):
    def setUp(self):self.server=types.SimpleNamespace(server_port=8765,token='test-token',jobs=Jobs())
    def tearDown(self):self.server.jobs.stop()
    def call(self,method,path,data=None,origin='http://127.0.0.1:8765',token='test-token',host='127.0.0.1:8765'):
        body=json.dumps(data).encode() if data is not None else b''
        header=f'{method} {path} HTTP/1.0\r\nHost: {host}\r\nOrigin: {origin}\r\nX-Local-Token: {token}\r\nContent-Length: {len(body)}\r\n\r\n'.encode()
        connection=Connection(header+body);Handler(connection,('127.0.0.1',1234),self.server)
        response=bytes(connection.output);head,body=response.split(b'\r\n\r\n',1)
        return int(head.split()[1]),body
    def test_page(self):
        status,body=self.call('GET','/');self.assertEqual(status,200);self.assertIn(b'test-token',body);self.assertNotIn(b'__TOKEN__',body)
    def test_preview(self):
        status,body=self.call('POST','/api/preview',{'language':'English','text':'Try 2.5 minutes.'});self.assertEqual(status,200);self.assertIn(b'two point five',body)
    def test_foreign_origin(self):self.assertEqual(self.call('POST','/api/cancel',{},origin='http://example.com')[0],403)
    def test_bad_token(self):self.assertEqual(self.call('POST','/api/cancel',{},token='wrong')[0],403)
    def test_bad_host(self):self.assertEqual(self.call('GET','/',host='example.com')[0],403)
    def test_traversal(self):self.assertEqual(self.call('GET','/audio/../../engines.py')[0],404)
    def test_busy(self):
        self.server.jobs.active='test';self.server.jobs.jobs['test']={'status':'running'}
        try:self.assertEqual(self.call('POST','/api/generate',{'language':'English','text':'Hello.'})[0],409)
        finally:self.server.jobs.active=None
    def test_unknown_job(self):self.assertEqual(self.call('GET','/api/job?id=unknown')[0],404)
    def test_bad_input(self):self.assertEqual(self.call('POST','/api/generate',{'model':'wrong','language':'English','text':'Hello.'})[0],400)
@unittest.skip('Copied v1.5 worker test; Nano residency requires validate_preload.py.')
class WorkerTests(unittest.TestCase):
    def test_cancel_and_restart(self):
        jobs=Jobs();request={'language':'English','text':'Take a breath. '*40}
        try:
            first=jobs.start(request);jobs.stop();self.assertEqual(jobs.jobs[first['job']]['status'],'cancelled')
            second=jobs.start(dict(request,text='You are not alone.'));deadline=time.monotonic()+180
            while time.monotonic()<deadline:
                with jobs.lock:jobs.refresh();result=jobs.jobs[second['job']]
                if result['status']!='running':break
                time.sleep(.1)
            self.assertEqual(result['status'],'complete',result)
            identity=result['voiceReference']['sha256']
            third=jobs.start(dict(request,text='Take a breath.'));deadline=time.monotonic()+180
            while time.monotonic()<deadline:
                with jobs.lock:jobs.refresh();result=jobs.jobs[third['job']]
                if result['status']!='running':break
                time.sleep(.1)
            self.assertEqual(result['status'],'complete',result)
            self.assertLess(result['loadSeconds'],1)
            self.assertEqual(result['voiceReference']['sha256'],identity)
        finally:jobs.stop()
if __name__=='__main__':unittest.main()
