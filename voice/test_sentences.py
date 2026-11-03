import unittest
from sentences import sentences,batches
class SentenceTests(unittest.TestCase):
    def test_schedule(self):self.assertEqual(list(batches(list('abcdefghi'))),[['a'],['b'],['c','d','e'],['f','g','h'],['i']])
    def test_small(self):
        self.assertEqual(list(batches([])),[]);self.assertEqual(list(batches(['a'])),[['a']]);self.assertEqual(list(batches(['a','b'])),[['a'],['b']])
    def test_sentence_coverage(self):
        text='You are not alone. Take a breath! Can we pause? Final fragment';parts=sentences(text)
        self.assertEqual(len(parts),4);self.assertEqual(''.join(parts),text)
    def test_abbreviations(self):self.assertEqual(sentences('Dr. Cruz and J. Smith can help. Try it.'),['Dr. Cruz and J. Smith can help. ','Try it.'])
    def test_no_character_splits(self):
        text=('A long sentence '*50)+'. Next.';self.assertEqual(len(sentences(text)),2);self.assertGreater(len(sentences(text)[0]),220)
    def test_quotes(self):self.assertEqual(sentences('She said "Keep going." Then rest.'),['She said "Keep going." ','Then rest.'])
    def test_decimal(self):self.assertEqual(sentences('Try 2.5 minutes. Then pause.'),['Try 2.5 minutes. ','Then pause.'])
if __name__=='__main__':unittest.main()
