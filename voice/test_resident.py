import unittest
from unittest.mock import patch
from resident import Pool
class FakeProcess:
    pid=123
    def poll(self):return None
class FakeWorker:
    created=0;calls=[]
    def __init__(self,python,kind):self.kind=kind;self.process=FakeProcess();FakeWorker.created+=1
    def call(self,r):self.calls.append((self.kind,r));return {'freeGPUBytes':3*1024**3}
    def close(self):pass
class PoolTests(unittest.TestCase):
    def test_models_retained(self):
        FakeWorker.created=0
        with patch('resident.verify_assets'),patch('resident.Worker',FakeWorker),patch('resident.Path.is_file',return_value=True):
            p=Pool();p.load();p.call('cbt',{'messages':[]});p.call('nano',{'text':'Hello'});p.load();self.assertEqual(FakeWorker.created,2);self.assertTrue(p.ready);p.close();self.assertFalse(p.ready)
    def test_not_ready(self):
        with self.assertRaises(RuntimeError):Pool().call('nano',{})
    def test_failed_loading_releases_both(self):
        with patch('resident.verify_assets'),patch('resident.Worker',side_effect=RuntimeError('blocked')),patch('resident.Path.is_file',return_value=True):
            p=Pool()
            with self.assertRaises(RuntimeError):p.load()
            self.assertFalse(p.ready);self.assertFalse(p.workers)
    def test_headroom_gate(self):
        with patch('resident.verify_assets'),patch('resident.Worker',FakeWorker),patch('resident.Path.is_file',return_value=True),patch.object(FakeWorker,'call',return_value={'freeGPUBytes':0}):
            p=Pool()
            with self.assertRaisesRegex(RuntimeError,'2 GiB'):p.load()
            self.assertFalse(p.ready)
if __name__=='__main__':unittest.main()
