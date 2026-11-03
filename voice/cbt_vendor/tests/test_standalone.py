"""Offline regression tests: no GPU, no model weights, no web access needed."""
from __future__ import annotations
import json
from pathlib import Path
import re
import subprocess
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import formatting as f
import echo_cbt_standalone as e

class TestFormatting(unittest.TestCase):
    def test_preserves_content_and_word_order(self):
        cases=[
            'It feels overwhelming.  You can try one thing now.\nStart with a single task.\n\nYou can do it at your own pace.',
            'Nakakapagod kapag sabay-sabay ang gawain. Baka puwedeng unahin ang isa ngayon. Ano ang pinaka-urgent?',
            'This is a very long thought. '*28,
            'The file says 1.25, 2.0 and 3.4. Keep the numbers as they are.',
            'I\'m really stressed! This can be difficult. What is the first step?',
        ]
        for original in cases:
            got=f.format_existing(original,max_paragraph_words=12)
            self.assertEqual(re.sub(r'\s+','',got),re.sub(r'\s+','',original.strip()))
            self.assertEqual(f.word_count(got),f.word_count(original))
    def test_structured_content_unchanged(self):
        text='1. Write your thoughts.\n2. Check the evidence.\n3. One next step.'
        self.assertEqual(f.format_existing(text),text)
    def test_empty_and_wrong_type(self):
        self.assertEqual(f.format_existing('  \n  '),'')
        with self.assertRaises(TypeError):f.format_existing(2)
    def test_paragraph_breaks(self):
        txt=' '.join(['One small step matters.']*15)
        got=f.format_existing(txt,max_paragraph_words=21)
        self.assertIn('\n\n',got)

class TestPolicy(unittest.TestCase):
    def test_exact_handover(self):
        pol=e.policy()
        self.assertEqual(pol['generationPolicy']['VERSION'],'selected_mixed_lr_1e4_v49_isolated_cascade_20261025')
        self.assertEqual(pol['runtime']['seqLength'],4096)
        self.assertEqual(pol['runtime']['maxNewTokens'],900)
        self.assertEqual(pol['runtime']['rewriteMaxNewTokens'],650)
        self.assertEqual(pol['generationPolicy']['CREATIVE_TEMPERATURE'],.75)
        self.assertEqual(pol['generationPolicy']['CREATIVE_TOP_P'],.92)
        self.assertEqual(pol['generationPolicy']['CREATIVE_TOP_K'],40)
    def test_preserves_original_prompt_and_appends_style(self):
        orig=e.policy()['generationPolicy']['V41_SYSTEM']
        new=e.system_prompt('I feel overwhelmed by schoolwork.')
        self.assertTrue(new.startswith(orig))
        self.assertIn('PRESENTATION-ONLY EXPERIMENT',new)
        self.assertIn('Never sacrifice safety completeness',new)
        self.assertTrue(e.system_prompt('Grabe sobra dami kong ginagawa paano ko to kakayanin').find('LANGUAGE FOR THIS TURN: Natural, contemporary Filipino')>0)
    def test_language_and_role(self):
        self.assertEqual(e.language('I feel overwhelmed by all my homework.'),'english')
        self.assertEqual(e.language('Grabe sobra dami kong ginagawa paano ko kaya to kakayanin.'),'filipino')
        self.assertEqual(e.language('Grabe sobrang dami ng deadlines and tasks, I feel overwhelmed.'),'taglish')
        self.assertEqual(e.role('Thank you!'),'brief')
        self.assertEqual(e.role('I am overwhelmed and I need help.'),'ordinary')
        self.assertEqual(e.role('What CBT worksheet can I give to my client?'),'professional')
    def test_deterministic_seed(self):
        hist=[{'role':'user','content':'I am stressed'}]
        system=e.system_prompt('I am stressed')
        self.assertEqual(e.seed_for(hist,system),e.seed_for(hist,system))
        self.assertNotEqual(e.seed_for(hist,system),e.seed_for(hist,system+'extra'))
    def test_safety_flag_no_false_approval_claim(self):
        self.assertTrue(e.safety_review_needed([{'role':'user','content':'I want to kill myself.'}]))
        self.assertTrue(e.safety_review_needed([{'role':'user','content':'I think about magpakamatay.'}]))
        self.assertFalse(e.safety_review_needed([{'role':'user','content':'I feel tired by my exams'}]))
    def test_context_validation(self):
        hist=[{'role':'user','content':'Hello'}]
        self.assertEqual(e.validate_history(hist),hist)
        for bad in ([],[{'role':'assistant','content':'Hi'}],[{'role':'system','content':'unsafe'}],
                    [{'role':'user','content':''}]):
            with self.assertRaises(ValueError):e.validate_history(bad)
    def test_quality_gates(self):
        self.assertEqual(e.quality_issues('You could start with one small task.', 'I am stressed', 'ordinary', False),[])
        self.assertIn('unfinished_structure_or_clause',e.quality_issues('You could start with', 'I am stressed', 'ordinary', False))
        self.assertIn('hard_token_limit',e.quality_issues('This is complete.','Question?', 'ordinary', True))
        self.assertIn('extreme_structural_overload',e.quality_issues('# 1. Steps\n- One thing.','User message','ordinary',False))
    def test_prompt_tokenization_sample_only(self):
        class FakeTokenizer:
            def __init__(self):self.chat_template='broken'
            def apply_chat_template(self,messages,tokenize=False,add_generation_prompt=False):
                if self.chat_template == 'broken':return 'not assistant'
                return '<|im_start|>user\nHello<|im_end|>\n<|im_start|>assistant\n'
            def get_vocab(self):return {'<|im_start|>':1,'<|im_end|>':2}
        fake=FakeTokenizer()
        self.assertEqual(e.verify_template(fake),'in_memory_chatml_repair')
        self.assertEqual(fake.chat_template,e.CHATML_TEMPLATE)

class TestCLI(unittest.TestCase):
    def test_format_mode_cpu(self):
        cmd=[sys.executable,str(ROOT/'echo_cbt_standalone.py'),'--mode','format','--json',
             '--text','This is hard.\nYou might try starting with one small task.']
        x=subprocess.run(cmd,text=True,capture_output=True,check=True)
        j=json.loads(x.stdout)
        self.assertFalse(j['content_changed'])
        self.assertEqual(j['word_count_before'],j['word_count_after'])
    def test_check_fails_for_missing_weights(self):
        cmd=[sys.executable,str(ROOT/'echo_cbt_standalone.py'),'--check',
             '--base-dir',str(ROOT/'__does_not_exist__'),
             '--adapter-dir',str(ROOT/'__also_does_not_exist__')]
        x=subprocess.run(cmd,text=True,capture_output=True)
        self.assertNotEqual(x.returncode,0)
        self.assertIn('Missing local base config',x.stderr)
    def test_crisis_withheld_without_loading_model(self):
        cmd=[sys.executable,str(ROOT/'echo_cbt_standalone.py'),'--mode','chat','--text','I want to kill myself','--json']
        x=subprocess.run(cmd,text=True,capture_output=True)
        self.assertEqual(x.returncode,2)
        self.assertTrue(json.loads(x.stdout)['needs_review'])
        self.assertIsNone(json.loads(x.stdout)['reply'])

if __name__=='__main__':unittest.main()


class TestAutomaticChatDelivery(unittest.TestCase):
    """These verify the full reply->format->deliver path without loading CUDA."""
    def good_attempt(self, text):
        return {'_raw_reply':text,'word_count':f.word_count(text),
                'role':'ordinary','language_heuristic':'english',
                'needs_review':False,'issues':[],'attempt':'initial'}

    def engine(self, first, second=None):
        model=e.LocalCBT.__new__(e.LocalCBT)
        model.template_state='mock_valid_chatml'
        call=[]
        def fake_attempt(turns,*,retry=False,allow_drops=True):
            call.append(('retry' if retry else 'initial',allow_drops))
            return dict(second if retry else first)
        model._attempt=fake_attempt
        return model,call

    def test_chat_auto_formats_before_display(self):
        raw=('That sounds exhausting when deadlines pile up and every task feels urgent. '
             'You do not have to solve the entire semester at once. '
             'Maybe try choosing one assignment and setting a realistic first step. '
             'You can return to the remaining work after that first step is clear. '
             'For now, a manageable first step is enough; you can adjust your plan later if you need to.')
        model,log=self.engine(self.good_attempt(raw))
        result=model.reply([{'role':'user','content':'I am worried about my assignments.'}])
        self.assertEqual(result['attempts'],1)
        self.assertTrue(result['auto_format_applied'])
        self.assertTrue(result['auto_format_preserved_content'])
        self.assertTrue(result['auto_format_layout_changed'])
        self.assertGreaterEqual(result['output_paragraphs'],2)
        self.assertIn('\n\n',result['reply'])
        self.assertEqual(re.sub(r'\s+','',result['reply']),re.sub(r'\s+','',raw))
        self.assertNotIn('_raw_reply',result)
        self.assertEqual(log,[('initial',True)])
        self.assertEqual(result['raw_response_sha256'],__import__('hashlib').sha256(raw.encode()).hexdigest())

    def test_rewrite_is_formatted_only_after_approval(self):
        first={'_raw_reply':'An unfinished','needs_review':True,'issues':['unfinished_structure_or_clause']}
        raw=('Feeling stuck after a disappointing grade can be discouraging. '
             'One low-pressure starting point might be to list the topics you missed. '
             'Pick a single topic and review the most confusing example. '
             'Would it help to start with the first missed question?')
        model,log=self.engine(first,self.good_attempt(raw))
        result=model.reply([{'role':'user','content':'I am anxious about my grades.'}])
        self.assertEqual(result['attempts'],2)
        self.assertTrue(result['rewrite_attempted'])
        self.assertTrue(result['auto_format_applied'])
        self.assertEqual(re.sub(r'\s+','',result['reply']),re.sub(r'\s+','',raw))
        self.assertNotIn('_raw_reply',result)
        self.assertEqual(log,[('initial',True),('retry',False)])

    def test_never_display_rejected_or_crisis_draft(self):
        first={'_raw_reply':'Bad unfinished draft','needs_review':True,'issues':['unfinished_structure_or_clause']}
        model,log=self.engine(first,first)
        result=model.reply([{'role':'user','content':'I feel stressed with schoolwork.'}])
        self.assertIsNone(result['reply'])
        self.assertNotIn('_raw_reply',result)
        self.assertNotIn('Bad unfinished draft',str(result))
        result2=model.reply([{'role':'user','content':'I want to kill myself.'}])
        self.assertIsNone(result2['reply'])
        self.assertEqual(len(log),2)

    def test_invalid_formatter_fails_closed(self):
        text='I hear how difficult this has been. Maybe start by writing one small task.'
        model,_=self.engine(self.good_attempt(text))
        original=e.style
        try:
            e.style=lambda: {'chat_output_format':{'enabled':False}}
            result=model.reply([{'role':'user','content':'I feel stressed with schoolwork.'}])
        finally:
            e.style=original
        self.assertTrue(result['needs_review'])
        self.assertIsNone(result['reply'])
        self.assertEqual(result['issues'],['auto_format_failed'])

    def test_format_mode_remains_content_preserving(self):
        text='This is difficult. Please try one step. You can start with a single task.'
        result=f.format_existing(text,max_paragraph_words=5)
        self.assertEqual(re.sub(r'\s+','',result),re.sub(r'\s+','',text))
        self.assertEqual(f.word_count(result),f.word_count(text))

    def test_structured_approved_response_keeps_layout(self):
        text='1. Identify one concern.\n2. Notice your thoughts.\n3. Try one next step.'
        formatted=f.format_chat_response(text,role='professional',config=e.style()['chat_output_format'])
        self.assertEqual(text,formatted)

    def test_chat_formatter_role_limits_and_idempotence(self):
        cfg=e.style()['chat_output_format']
        text='One small step can be helpful. '*35
        once=f.format_chat_response(text,role='ordinary',config=cfg)
        twice=f.format_chat_response(once,role='ordinary',config=cfg)
        self.assertEqual(once,twice)
        self.assertIn('\n\n',once)
        with self.assertRaises(ValueError):f.format_chat_response(text,role='unknown',config=cfg)
