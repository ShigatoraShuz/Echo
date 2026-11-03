import json,threading,unittest,urllib.request,urllib.error
import numpy as np
from text_audio import prepare,chunks,validate,assemble
from server import make_server
class TextTests(unittest.TestCase):
    def test_numbers(self):
        self.assertEqual(prepare('Try 2.5 minutes and 123 breaths.','English'),'Try two point five minutes and one hundred twenty three breaths.')
        self.assertEqual(prepare('Huminga nang 3 beses.','Filipino'),'Huminga nang tatlo beses.')
        self.assertEqual(prepare('2000','Filipino'),'dalawang libo')
    def test_ambiguous(self):
        for s in ('At 10:30.','Save 5%.','Pay $20.','On 11/02.','Value -5.','ID 001.','A123','1000000','Version 1.2.3'):
            with self.subTest(s=s),self.assertRaises(ValueError):prepare(s,'English')
    def test_meaning(self):self.assertEqual(prepare('1. **Do not stop.**\n2. You are not alone.','English'),'Do not stop. You are not alone.')
    def test_final_fragment(self):
        text='Please take a breath. '*40+'Final unfinished fragment';parts=chunks(text)
        self.assertEqual(''.join(parts),text);self.assertTrue(parts[-1].endswith('Final unfinished fragment'));self.assertTrue(all(len(p)<=220 for p in parts))
    def test_long_word(self):
        with self.assertRaises(ValueError):chunks('x'*221)
    def test_unicode(self):self.assertEqual(prepare('“Hindi ka nag-iisa.”','Filipino'),'"Hindi ka nag-iisa."')
    def test_audio(self):
        wave=validate(np.ones((1000,2))*1.2,48000);raw,out=assemble([wave,wave],48000)
        self.assertEqual(raw.shape,out.shape);self.assertLessEqual(float(out.max()),.980001);self.assertEqual(float(out[-1,0]),0)
    def test_invalid_audio(self):
        for wave in (np.zeros(10),np.array([np.nan]),np.ones((10,3))):
            with self.assertRaises(ValueError):validate(wave,16000)
class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=make_server(0);cls.base='http://127.0.0.1:'+str(cls.server.server_port)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.jobs.stop();cls.server.server_close();cls.thread.join()
    def post(self,path,data,origin=None,token=None):
        return urllib.request.urlopen(urllib.request.Request(self.base+path,data=json.dumps(data).encode(),headers={'Origin':origin or self.base,'X-Local-Token':token or self.server.token,'Content-Type':'application/json'}))
    def test_page(self):
        text=urllib.request.urlopen(self.base).read().decode();self.assertIn(self.server.token,text);self.assertNotIn('__TOKEN__',text)
    def test_preview(self):
        with self.post('/api/preview',{'language':'English','text':'Try 2.5 minutes.'}) as r:self.assertIn('two point five',json.load(r)['text'])
    def test_foreign_origin(self):
        with self.assertRaises(urllib.error.HTTPError) as e:self.post('/api/cancel',{},origin='http://example.com')
        self.assertEqual(e.exception.code,403)
    def test_missing_token(self):
        with self.assertRaises(urllib.error.HTTPError) as e:self.post('/api/cancel',{},token='wrong')
        self.assertEqual(e.exception.code,403)
    def test_unknown_audio(self):
        with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(self.base+'/audio/../../engines.py')
        self.assertEqual(e.exception.code,404)
    def test_busy(self):
        with self.server.jobs.lock:self.server.jobs.active='test';self.server.jobs.jobs['test']={'status':'running'}
        try:
            with self.assertRaises(urllib.error.HTTPError) as e:self.post('/api/generate',{'language':'English','text':'Hello.'})
            self.assertEqual(e.exception.code,409)
        finally:self.server.jobs.active=None
if __name__=='__main__':unittest.main()
