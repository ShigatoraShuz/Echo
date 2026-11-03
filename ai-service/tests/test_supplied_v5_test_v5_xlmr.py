import unittest, tempfile, json, sys, subprocess
from pathlib import Path
from app.vendor.cbt.v5 import echo_cbt_standalone as b
from app.vendor.cbt.v5 import v4_controls as legacy
from app.vendor.cbt.v5 import run_echo_v5 as v5
from app.vendor.cbt.v5.xlmr_router import label_lookup, configuration, decide, review_result

class FakeScreen:
 def __init__(self,score=.04,threshold=.1698,by_text=None):self.score=score;self.threshold=threshold;self.by_text=by_text or {}
 def classify(self,text):
  sc=self.by_text.get(text,self.score)
  return {'screening_flag':sc>=self.threshold,'highest_suicidal_window_score':sc,
          'screening_threshold':self.threshold,'relative_class_scores':{'others':1-sc,'suicidal':sc},'windows':1}

class XLMRTests(unittest.TestCase):
 def test_label_order(self):
  self.assertEqual(label_lookup({},['Others','Anxious','Depressed','Frustrated','Suicidal'])[4],'suicidal')
 def test_ambiguous_labels_rejected(self):
  with self.assertRaises(ValueError):label_lookup({i:f'LABEL_{i}' for i in range(5)})
 def test_bad_threshold_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'a.json';p.write_text(json.dumps({'suicidal_screening_threshold':12,'max_length':384,'window_stride':96}))
   with self.assertRaises(ValueError):configuration(p)
 def test_contextual_give_up_allowed_after_negative_screen(self):
  t=[{'role':'user','content':'I dont know what to do since I have a lot of things in my plate and I wanna give up'}]
  d=decide(t,FakeScreen(),legacy,language_fn=b.language)
  self.assertEqual(d['route'],'support_with_clarification');self.assertTrue(d['generation_allowed'])
 def test_contextual_give_up_positive_requires_review(self):
  t=[{'role':'user','content':'I wanna give up on my school tasks'}]
  d=decide(t,FakeScreen(.8),legacy)
  self.assertEqual(d['route'],'safety_review')
 def test_urgent_override_negative(self):
  t=[{'role':'user','content':'I want to hurt myself'}]
  d=decide(t,FakeScreen(.01),legacy)
  self.assertEqual(d['route'],'safety_support')
 def test_unqualified_ambiguous_requires_review(self):
  t=[{'role':'user','content':'I wanna give up'}]
  d=decide(t,FakeScreen(.01),legacy)
  self.assertEqual(d['route'],'clarification_review')
 def test_previous_flag_is_sticky(self):
  t=[{'role':'user','content':'I am feeling terrible'},{'role':'assistant','content':'I hear you'},
     {'role':'user','content':'What is one thing I could try?'}]
  d=decide(t,FakeScreen(by_text={'I am feeling terrible':.8}),legacy)
  self.assertFalse(d['generation_allowed'])
 def test_no_clinical_label(self):
  d=decide([{'role':'user','content':'I feel tired'}],FakeScreen(),legacy)
  self.assertIs(d['clinical_risk_assessed'],False)
 def test_missing_xlmr_fails_closed(self):
  class Args:xlmr_dir=None;xlmr_config='unused'
  original=v5.os.environ.pop('ECHO_XLMR_V2_DIR',None)
  try:
   with self.assertRaises(ValueError):v5.get_screener(Args)
  finally:
   if original is not None:v5.os.environ['ECHO_XLMR_V2_DIR']=original
 def test_no_rigid_question_required(self):
  ans='That sounds like a heavy workload. Maybe choose one task you can begin with today.'
  issues=v5.policy_quality(ans,'I wanna give up on my assignments',b.role('I wanna give up on my assignments'),False)
  self.assertNotIn('ambiguity_requires_gentle_safety_clarification',issues)
 def test_still_rejects_dangling_steps(self):
  issues=v5.policy_quality('1. Choose one. 2. Make a list. 3.','List steps that I could do','steps',False)
  self.assertTrue(issues)
 def test_review_has_no_model_reply(self):
  d=decide([{'role':'user','content':'I am suicidal'}],FakeScreen(.8),legacy)
  r=review_result(d,v5.VERSION);self.assertIsNone(r['reply']);self.assertTrue(r['needs_review'])
 def test_mock_good_generation(self):
  class FakeEngine:
   template_state='mock'
   def _attempt(self,history,**kwargs):
    return {'_raw_reply':'I hear how much pressure you are under. You could try picking one task to begin with.',
     'needs_review':False,'issues':[],'role':'ordinary','attempt':'initial'}
   def _approved_for_output(self,result):
    out=dict(result);out['reply']=out.pop('_raw_reply');return out
  decision=decide([{'role':'user','content':'I wanna give up on my assignments'}],FakeScreen(),legacy)
  r=v5.generate_approved(FakeEngine(),[{'role':'user','content':'I wanna give up on my assignments'}],decision)
  self.assertTrue(r['model_output']);self.assertFalse(r['needs_review'])
 def test_format_preserves_words(self):
  self.assertIn('write',b.format_existing('First write down your tasks. Then choose one.'))
 def test_model_identity(self):
  self.assertIn('mixed_lr_1e4',v5.MODEL_ID)

if __name__=='__main__':unittest.main()
