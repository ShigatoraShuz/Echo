import json
import tempfile
import unittest
from pathlib import Path
import numpy as np
from engines import ROOT,Engines
from runner import check
from voice_store import VoiceStore,PROMPT

class VoiceTests(unittest.TestCase):
    def setUp(self):
        folder=ROOT/'work/tests';folder.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=folder)
        self.store=VoiceStore(Path(self.temp.name)/'voices')
        self.calls=0
    def tearDown(self):self.temp.cleanup()
    def sample(self,text,language):
        self.calls+=1;self.assertEqual(text,PROMPT);self.assertEqual(language,'English')
        return np.ones((96000,2),np.float32)*.1,48000,{}
    def test_creation_and_restart(self):
        _,_,first=self.store.ensure(self.sample)
        _,_,again=VoiceStore(self.store.root).ensure(self.sample)
        self.assertEqual(self.calls,1);self.assertEqual(first['sha256'],again['sha256'])
    def test_corrupt_sample_is_not_replaced(self):
        self.store.ensure(self.sample);(self.store.active/'sample.wav').write_bytes(b'corrupt')
        with self.assertRaisesRegex(ValueError,'not replaced'):self.store.ensure(self.sample)
        self.assertEqual(self.calls,1)
    def test_partial_active_is_error(self):
        self.store.active.mkdir(parents=True)
        with self.assertRaises(ValueError):self.store.ensure(self.sample)
        self.assertEqual(self.calls,0)
    def test_interruption_never_activates(self):
        def interrupted(*args):raise InterruptedError('Cancelled')
        with self.assertRaises(InterruptedError):self.store.ensure(interrupted)
        self.assertFalse(self.store.active.exists())
        self.store.ensure(self.sample);self.assertTrue(self.store.active.exists())
    def test_bad_metadata(self):
        self.store.ensure(self.sample);path=self.store.active/'metadata.json'
        meta=json.loads(path.read_text());meta['sha256']='bad';path.write_text(json.dumps(meta))
        with self.assertRaises(ValueError):self.store.read()
    def test_reject_mms(self):
        with self.assertRaisesRegex(ValueError,'Only MOSS'):check({'model':'MMS','text':'Hello','language':'English'})
        with self.assertRaises(ValueError):Engines().load('MMS')
    def test_no_model_required(self):self.assertEqual(check({'text':'Hello','language':'English'}),'Hello')
    def test_no_voice_selector(self):
        with self.assertRaises(ValueError):check({'voice':'eng','text':'Hello','language':'English'})
if __name__=='__main__':unittest.main()
