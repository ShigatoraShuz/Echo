import unittest,queue,io,json
from segmenting import speech_segments
from resident import Worker
class BufferedTests(unittest.TestCase):
    def test_coverage(self):
        text='You are not alone. '+('We can take one step at a time. '*30)+'Final unfinished fragment'
        parts=speech_segments(text);self.assertEqual(''.join(parts),text);self.assertEqual(parts[0],'You are not alone. ');self.assertLessEqual(len(parts[0]),140);self.assertTrue(all(len(x)<=220 for x in parts));self.assertTrue(parts[-1].endswith('fragment'))
    def test_no_shortening(self):
        text='A long sentence without punctuation '*20;self.assertEqual(''.join(speech_segments(text)),text)
    def test_word_excess(self):
        with self.assertRaises(ValueError):speech_segments('x'*221)
    def test_events_not_final_results(self):
        from unittest.mock import patch
        worker=Worker.__new__(Worker);worker.replies=queue.Queue();worker.process=type('P',(),{'stdin':io.StringIO()})();events=[]
        worker.replies.put({'id':'key','event':'segment_ready','segment':{'index':0}});worker.replies.put({'id':'key','result':{'status':'complete'}})
        with patch('resident.uuid.uuid4') as u:
            u.return_value.hex='key';result=worker.call({},events.append)
        self.assertEqual(events,[{'index':0}]);self.assertEqual(result['status'],'complete')
    def test_unrelated_events_ignored(self):
        from unittest.mock import patch
        worker=Worker.__new__(Worker);worker.replies=queue.Queue();worker.process=type('P',(),{'stdin':io.StringIO()})();events=[]
        worker.replies.put({'id':'old','event':'segment_ready','segment':{'index':0}});worker.replies.put({'id':'key','result':{}})
        with patch('resident.uuid.uuid4') as u:u.return_value.hex='key';worker.call({},events.append)
        self.assertEqual(events,[])
if __name__=='__main__':unittest.main()
