"""Regression cases for incomplete steps, manual lists, width, and ambiguity.

CPU only; does not load a model or modify Echo.
"""
import json
import hashlib
import re
import subprocess
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import echo_cbt_standalone as e
import formatting as f

USER1='I dont know what to do since I have a lot of things in my plate and I wanna give up'
USER2='List steps that I could do'
BAD=('Sure, here are some steps you can consider taking: 1. Create a to-do list: '
     'Write down all the tasks or responsibilities you have on your plate. '
     '2. Prioritize: Look at your list and determine which tasks are most important or urgent. '
     '3. Break it down: Once you have identified the priority tasks, break them '
     'down into smaller, more manageable steps. 4.')
GOOD=('Here are three steps you can try: 1. Write down all your tasks. '
      '2. Choose the one that needs attention first. '
      '3. Break it into one small action you can start now.')

class TestV3Policy(unittest.TestCase):
 def test_classifies_follow_up_as_steps(self):
  for u in (USER2,'Give me steps','Can you give me a list of steps?',
            'Step by step please','Explain the steps','Give me bullet points',
            'What steps can I take?'):
   self.assertEqual(e.role(u),'steps',u)
 def test_does_not_force_steps_for_ordinary(self):
  self.assertEqual(e.role(USER1),'ordinary')
  self.assertEqual(e.role('Thanks'),'brief')
  self.assertEqual(e.role('What CBT protocol can I use for my client?'),'professional')
 def test_original_policy_retained(self):
  p=e.policy()['generationPolicy']
  self.assertTrue(e.system_prompt(USER2).startswith(p['V41_SYSTEM']))
  self.assertTrue(e.system_prompt(USER2,retry=True).startswith(p['REWRITE_SYSTEM']))
  self.assertIn('SHORT readable numbered list',e.system_prompt(USER2))
  self.assertIn('AMBIGUOUS LANGUAGE',e.system_prompt(USER1))
  self.assertNotIn('AMBIGUOUS LANGUAGE',e.system_prompt(USER2))
  self.assertEqual(e.style()['word_targets']['steps'],105)
 def test_unfinished_marker_is_not_complete(self):
  for text in (BAD,'1. Write tasks. 2. Prioritize. 3.',
               'You can try these: 1. Write your tasks. 2. ',
               'Step 3:', 'Try the following:\n-'):
   self.assertFalse(e.sentence_boundary(text,'steps'),text)
   issues=e.quality_issues(text,USER2,'steps',False)
   self.assertIn('unfinished_structure_or_clause',issues,text)
 def test_good_requested_steps(self):
  self.assertTrue(e.sentence_boundary(GOOD,'steps'))
  self.assertEqual(e.quality_issues(GOOD,USER2,'steps',False),[])
 def test_step_completion_and_sequence(self):
  self.assertIn('requested_step_list_missing',e.quality_issues('Consider choosing one first.',USER2,'steps',False))
  self.assertIn('nonconsecutive_step_numbering',e.quality_issues('1. First. 3. Third.',USER2,'steps',False))
  self.assertIn('hard_token_limit',e.quality_issues(GOOD,USER2,'steps',True))
 def test_lists_remain_disallowed_for_ordinary(self):
  self.assertIn('extreme_structural_overload', e.quality_issues('1. Write tasks.\n2. Prioritize.',USER1,'ordinary',False))
 def test_ambiguity_contextual_vs_urgent(self):
  for t,disp in [
   (USER1,'contextual_ambiguous'),
   ('I wanna give up','ambiguous_unqualified'),
   ('I just wanna give up','ambiguous_unqualified'),
   ('I feel like giving up','ambiguous_unqualified'),
   ('Gusto ko nang sumuko','ambiguous_unqualified'),
   ('I wanna give up on life','explicit_urgent'),
   ('I want to kill myself','explicit_urgent'),
   ('I feel overwhelmed by deadlines','ordinary'),
   ('I wanna give up on my assignments','contextual_ambiguous'),
  ]:
   self.assertEqual(e.safety_disposition([{'role':'user','content':t}]),disp,t)
  self.assertFalse(e.safety_review_needed([{'role':'user','content':USER1}]))
  self.assertTrue(e.safety_review_needed([{'role':'user','content':'I wanna give up'}]))
 def test_review_not_diagnosis(self):
  self.assertEqual(e.safety_withhold('ambiguous_unqualified')['reply'],None)
  self.assertEqual(e.safety_withhold('explicit_urgent')['needs_review'],True)
  self.assertIn('router',e.safety_withhold('ambiguous_unqualified')['warning'])

class TestV3Formatting(unittest.TestCase):
 def test_inline_steps_split_on_their_own_lines(self):
  output=f.format_existing(GOOD)
  self.assertIn('\n2. Choose',output)
  self.assertIn('\n3. Break',output)
  self.assertEqual(re.sub(r'\s+','',output),re.sub(r'\s+','',GOOD))
 def test_given_bad_response_stays_bad_until_approval(self):
  formatted=f.format_chat_response(BAD,role='steps',config=e.style()['chat_output_format'])
  self.assertIn('4.',formatted)
  self.assertEqual(re.sub(r'\s+','',formatted),re.sub(r'\s+','',BAD))
  # Formatter is never allowed to remove 4. or replace missing advice.
  self.assertNotEqual(e.quality_issues(BAD,USER2,'steps',False),[])
 def test_decimals_safe(self):
  t='I checked values 1.25, 2.0, and 3.14. Keep these numbers in place.'
  self.assertEqual(f.format_existing(t),t)
 def test_existing_multi_line_list_safe(self):
  t='1. Write it.\n2. Check it.\n3. Try it.'
  self.assertEqual(f.format_existing(t),t)
 def test_render_wrap_keeps_words(self):
  original=f.format_existing(GOOD)
  wrapped=f.wrap_for_console(original,45)
  self.assertEqual(re.sub(r'\s+','',wrapped),re.sub(r'\s+','',original))
  self.assertIn('\n',wrapped)
  self.assertIn('2. Choose',wrapped)
  self.assertNotIn('Prioriti\nze',wrapped)
 def test_join_terminal_line_wrap_from_text_file(self):
  t="It's\n completely understandable to feel overwhelmed."
  self.assertEqual(f.format_existing(t),"It's completely understandable to feel overwhelmed.")
 def test_bad_width(self):
  with self.assertRaises(ValueError): f.wrap_for_console('text',12)
 def test_chat_formatter_preserves_every_non_whitespace(self):
  t=f.format_chat_response(GOOD,role='steps',config=e.style()['chat_output_format'])
  self.assertEqual(re.sub(r'\s+','',t),re.sub(r'\s+','',GOOD))

class TestV3Delivery(unittest.TestCase):
 def dummy(self, first, second=None):
  model=e.LocalCBT.__new__(e.LocalCBT);model.template_state='mock'
  calls=[]
  def fake(h,*,retry=False,allow_drops=True):
   calls.append(retry)
   return dict(second if retry else first)
  model._attempt=fake
  return model,calls
 def attempt(self, raw, *, fail=False):
  issues=e.quality_issues(raw,USER2,'steps',False)
  return {'_raw_reply':raw,'needs_review':bool(issues) or fail,
          'issues':issues,'role':'steps','language_heuristic':'english','word_count':f.word_count(raw)}
 def test_retry_restores_usable_complete_list(self):
  model,calls=self.dummy(self.attempt(BAD),self.attempt(GOOD))
  result=model.reply([{'role':'user','content':USER2}])
  self.assertEqual(result['reply'],f.format_chat_response(GOOD,role='steps',config=e.style()['chat_output_format']))
  self.assertTrue(result['rewrite_attempted'])
  self.assertEqual(calls,[False,True])
  self.assertEqual(result['attempts'],2)
 def test_both_truncated_withheld(self):
  model,calls=self.dummy(self.attempt(BAD),self.attempt(BAD))
  result=model.reply([{'role':'user','content':USER2}])
  self.assertTrue(result['needs_review']);self.assertIsNone(result['reply'])
  self.assertIn('dangling_list_or_clause',result['issues'])
  self.assertNotIn('Create a to-do list',str(result))
  self.assertEqual(calls,[False,True])
 def test_unqualified_ambiguous_withheld_before_generation(self):
  model,calls=self.dummy(self.attempt(GOOD))
  result=model.reply([{'role':'user','content':'I wanna give up'}])
  self.assertTrue(result['needs_review']);self.assertIsNone(result['reply'])
  self.assertEqual(calls,[])
 def test_followup_context_preserved(self):
  hist=[{'role':'user','content':USER1},
        {'role':'assistant','content':'I hear that you have several tasks on your plate. Which feels most urgent?'},
        {'role':'user','content':USER2}]
  model,calls=self.dummy(self.attempt(GOOD))
  result=model.reply(hist)
  self.assertEqual(result['attempts'],1)
  self.assertTrue(result['auto_format_preserved_content'])
  self.assertEqual(calls,[False])

class TestV3CLI(unittest.TestCase):
 def test_format_mode_inline_steps(self):
  cmd=[sys.executable,str(ROOT/'echo_cbt_standalone.py'),'--mode','format','--text',GOOD,'--wrap-width','72']
  r=subprocess.run(cmd,check=True,capture_output=True,text=True)
  self.assertIn('\n2. Choose',r.stdout)
 def test_json_unwrapped_and_preserved(self):
  cmd=[sys.executable,str(ROOT/'echo_cbt_standalone.py'),'--mode','format','--text',GOOD,'--json']
  result=subprocess.run(cmd,check=True,capture_output=True,text=True)
  data=json.loads(result.stdout)
  self.assertFalse(data['content_changed'])
  self.assertEqual(re.sub(r'\s+','',data['reply']),re.sub(r'\s+','',GOOD))
 def test_audit_regression_works_without_gpu(self):
  cmd=[sys.executable,str(ROOT/'echo_cbt_standalone.py'),'--mode','audit',
       '--text',BAD,'--latest-user',USER2]
  r=subprocess.run(cmd,check=True,capture_output=True,text=True)
  d=json.loads(r.stdout)
  self.assertFalse(d['accepted'])
  self.assertEqual(d['inferred_role'],'steps')
  self.assertIn('dangling_list_or_clause',d['quality_issues'])
 def test_crisis_withheld(self):
  cmd=[sys.executable,str(ROOT/'echo_cbt_standalone.py'),'--mode','chat','--text','I wanna give up']
  r=subprocess.run(cmd,capture_output=True,text=True)
  self.assertEqual(r.returncode,2)
  self.assertIn('unqualified_give_up_requires_human_safety_review',r.stdout)
 def test_no_implicit_gpu_download(self):
  # No CUDA imports for unit tests / --mode format.
  self.assertNotIn('torch',sys.modules)

if __name__=='__main__':unittest.main()
