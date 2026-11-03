import json,queue,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import conversation
from engines import ROOT
class Jobs:
    def __init__(self):self.jobs={};self.stops=0
    def stop(self):self.stops+=1
class Process:
    def start(self):pass
    def join(self,*args):pass
    def is_alive(self):return False
@unittest.skip('Copied v1.5 subprocess lifecycle tests; Nano uses test_resident and validate_preload.')
class ConversationTests(unittest.TestCase):
    def setUp(self):
        folder=ROOT/'work/tests';folder.mkdir(parents=True,exist_ok=True);self.temp=tempfile.TemporaryDirectory(dir=folder)
        self.patch=patch.object(conversation,'ROOT',Path(self.temp.name));self.patch.start();self.chat=conversation.Conversations(Jobs());self.session=self.chat.session()
    def tearDown(self):self.patch.stop();self.temp.cleanup()
    def turn(self):
        t={'id':'a'*32,'session':self.session['id'],'status':'running','timings':{}};self.chat.active=t['id'];self.chat.turns[t['id']]=t;return t
    def test_saved_history(self):
        self.session['messages'].append({'role':'user','content':'Hello'});self.chat.save(self.session)
        self.assertEqual(self.chat.session(self.session['id'])['messages'][0]['content'],'Hello')
    def test_path_traversal(self):
        with self.assertRaises(ValueError):self.chat.session('../outside')
    def test_withhold_never_speaks(self):
        self.chat.cbt=lambda *args:{'needs_review':True,'reply':None,'issues':['incomplete']}
        t=self.turn()
        with patch.object(conversation.mp,'Process') as process:self.chat.run(t,{'text':'Hello','language':'English'},None);process.assert_not_called()
        self.assertEqual(t['status'],'withheld');self.assertEqual(len(self.chat.session(t['session'])['messages']),1)
    def test_approved_reply_retained_when_speech_fails(self):
        self.chat.cbt=lambda *args:{'reply':'You can take a breath.','needs_review':False}
        tasks,replies=queue.Queue(),queue.Queue();replies.put(('a'*32,'result',{'status':'failed','error':'GPU unavailable'}));t=self.turn()
        with patch.object(conversation.mp,'Queue',side_effect=[tasks,replies]),patch.object(conversation.mp,'Process',return_value=Process()):self.chat.run(t,{'text':'Hello','language':'English'},None)
        self.assertEqual(t['status'],'failed');self.assertEqual(self.chat.session(t['session'])['messages'][-1]['content'],'You can take a breath.')
    def test_completed_audio_published(self):
        self.chat.cbt=lambda *args:{'reply':'Take a breath.','needs_review':False}
        tasks,replies=queue.Queue(),queue.Queue();replies.put(('a'*32,'result',{'status':'complete','voiceReference':{'sha256':'fixed'}}));t=self.turn()
        with patch.object(conversation.mp,'Queue',side_effect=[tasks,replies]),patch.object(conversation.mp,'Process',return_value=Process()):self.chat.run(t,{'text':'Hello','language':'English'},None)
        self.assertEqual(t['status'],'complete');self.assertIn(t['id'],self.chat.jobs.jobs)
    def test_cancelled_job_cannot_spawn_cbt(self):
        t=self.turn();self.chat.cancel()
        with patch.object(conversation.subprocess,'Popen') as process:
            with self.assertRaises(RuntimeError):self.chat.cbt({'messages':[]},t)
            process.assert_not_called()
    def test_bad_recording(self):
        with self.assertRaises(ValueError):self.chat.start({'audio':'AA==','session':self.session['id']})
    def test_adapter_is_exact(self):
        from cbt_bridge import ADAPTER
        self.assertIn('mixed_epochs_2',str(ADAPTER))
if __name__=='__main__':unittest.main()
