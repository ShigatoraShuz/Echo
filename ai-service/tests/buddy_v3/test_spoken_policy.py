"""Behavioral regressions for voice acceptance; no GPU/model downloads required."""
import sys
from pathlib import Path
from unittest.mock import Mock
import pytest

sys.path.insert(0, str(Path(__file__).parents[2] / 'app/buddy/v3'))
import echo_cbt_standalone as e
from app.buddy.diagnostics import diagnostics


def candidate(text, prompt, role='brief', limited=False):
    issues=e.quality_issues(text,prompt,role,limited)
    return {'_raw_reply':text,'role':role,'issues':issues,'needs_review':bool(issues)}


def engine(*drafts):
    value=e.LocalCBT.__new__(e.LocalCBT)
    value.template_state='synthetic'
    value._attempt=Mock(side_effect=drafts)
    return value


def test_spoken_accepts_complete_long_formatted_reply_and_keeps_findings():
    prompt='I had a difficult day.'
    text='\n'.join(f'- This complete reflection includes a different detail number {i} about today.' for i in range(10))
    result=engine(candidate(text,prompt),candidate(text,prompt)).reply([{'role':'user','content':prompt}],delivery_mode='voice')
    assert result['reply'] and not result['needs_review']
    assert 'extreme_response_length' in result['advisory_issues']
    assert 'extreme_structural_overload' in result['advisory_issues']


def test_journal_length_is_advisory_but_support_and_completeness_still_block():
    prompt='Give me exactly two steps for my deadline.'
    text='1. Open your document and write one heading.\n2. Set a timer and draft one sentence.'
    draft={'_raw_reply':text,'role':'steps','issues':['extreme_response_length'],'needs_review':True}
    result=engine(dict(draft),dict(draft)).reply([{'role':'user','content':prompt}],strict_review=True)
    assert result['reply'] and not result['needs_review']
    assert result['advisory_issues']==['extreme_response_length']
    for issue in ('persistent_distress_support_missing','incomplete_list_item','requested_step_count_mismatch'):
        bad={**draft,'issues':['extreme_response_length',issue]}
        result=engine(dict(bad),dict(bad)).reply([{'role':'user','content':prompt}],strict_review=True)
        assert result['needs_review'] and issue in result['issues']


def test_real_journal_prompt_keeps_two_complete_items_and_removes_unfinished_third():
    from app.model.core import CoreRuntime
    runtime=CoreRuntime.__new__(CoreRuntime)
    runtime.chat=Mock(return_value={'reply':None})
    runtime.journal_recommendation('A synthetic difficult deadline.',
        {'suicidal_language_flag':False},{'dominant_plutchik':'sadness'})
    prompt=runtime.chat.call_args.args[0][0]['content']
    assert e.response_role(prompt)=='steps'
    assert e.list_target(prompt)==2
    bad='1. Track your energy in a notebook.\n2. Set a timer for a short break.\n3. **Create a “self-compassion cue”'
    draft=candidate(bad,prompt,'steps')
    assert 'requested_step_count_mismatch' in draft['issues']
    result=engine(dict(draft),dict(draft)).reply([{'role':'user','content':prompt}],strict_review=True)
    assert not result['needs_review'] and result['reply']
    assert 'self-compassion' not in result['reply']
    assert 'Track your energy in a notebook.' in result['reply']
    assert result['unfinished_journal_tail_removed']


def test_journal_tail_removal_preserves_one_item_but_never_empty_or_missing_support():
    prompt='Give me exactly two steps.'
    text='1. Open your notebook and write one task.\n2. Start with'
    result=engine(candidate(text,prompt,'steps')).reply([{'role':'user','content':prompt}],strict_review=True)
    assert result['reply']=='1. Open your notebook and write one task.'
    bad=candidate('1. Start with',prompt,'steps')
    result=engine(dict(bad),dict(bad)).reply([{'role':'user','content':prompt}],strict_review=True)
    assert result['needs_review'] and not result['reply']
    persistent=prompt+' For weeks I feel empty and no longer enjoy things.'
    bad=candidate(text,persistent,'steps')
    result=engine(dict(bad),dict(bad)).reply([{'role':'user','content':persistent}],strict_review=True)
    assert result['needs_review'] and 'persistent_distress_support_missing' in result['issues']


def test_voice_selects_fewer_advisories_but_never_selects_incomplete_rewrite():
    prompt='How can I start my assignment?'
    first=candidate("You're not alone. Open the document and write the first heading.",prompt)
    good=candidate('Open the document and write the first heading.',prompt)
    result=engine(dict(first),good).reply([{'role':'user','content':prompt}],delivery_mode='voice')
    assert result['reply']=='Open the document and write the first heading.'
    broken=candidate('Start with',prompt)
    result=engine(dict(first),broken).reply([{'role':'user','content':prompt}],delivery_mode='voice')
    assert result['reply'].startswith("You're not alone.")


@pytest.mark.parametrize('count',[1,3,7,10,12])
def test_spoken_lists_remain_exact_and_complete(count):
    prompt=f'Give me {count} tips'
    text='\n'.join(f'{i}. Open distinct task {i} and write its first action.' for i in range(1,min(count,10)+1))
    result=engine(candidate(text,prompt,'steps')).reply([{'role':'user','content':prompt}],delivery_mode='voice')
    assert result['reply'] and not result['needs_review']
    bad=candidate('1. Start with',prompt,'steps')
    result=engine(dict(bad),dict(bad)).reply([{'role':'user','content':prompt}],delivery_mode='voice')
    assert result['needs_review'] and not result['reply']


def test_persistent_support_and_safety_remain_blocking():
    prompt='For weeks I feel empty and no longer enjoy things. How can I start?'
    bad=candidate('Choose a hobby to try.',prompt)
    result=engine(dict(bad),dict(bad)).reply([{'role':'user','content':prompt}],delivery_mode='voice')
    assert 'persistent_distress_support_missing' in result['issues']
    value=engine()
    result=value.reply([{'role':'user','content':'I want to kill myself.'}],delivery_mode='voice')
    assert result['needs_review'];value._attempt.assert_not_called()


def test_token_cap_without_incomplete_thought_is_advisory_and_journal_stays_strict():
    prompt='I had a hard day.'
    draft=candidate('It sounds like today was difficult.',prompt,limited=True)
    result=engine(dict(draft),dict(draft)).reply([{'role':'user','content':prompt}],delivery_mode='voice')
    assert result['reply'] and 'hard_token_limit' in result['advisory_issues']
    result=engine(dict(draft),dict(draft)).reply([{'role':'user','content':prompt}],strict_review=True)
    assert result['needs_review'] and not result['reply']
    assert e.generation_budget('voice')==e.generation_budget('voice',True)==1536
    assert e.generation_budget('chat')==e.generation_budget('chat',True)==1536


def test_voice_prompt_preserves_counselor_guidance_without_sentence_template():
    prompt=e.system_prompt('For weeks I feel empty and no longer enjoy things. How can I start?',delivery_mode='voice')
    assert 'SECOND sentence' not in prompt and 'three or four sentences' not in prompt
    assert 'one or two short, complete sentences' not in prompt
    assert 'professional support' in prompt and 'one relevant action' in prompt


def test_diagnostics_cannot_contain_private_text():
    result=diagnostics({'issues':['empty','private user draft'],'attempts':2,'attempt_diagnostics':[{'blockingIssues':['unfinished_structure_or_clause','private draft']} ]})
    assert result['blockingIssues']==['empty']
    assert result['attemptDiagnostics'][0]['blockingIssues']==['unfinished_structure_or_clause']


def test_retries_vary_both_modes_and_remain_reproducible_per_attempt():
    turns=[{'role':'user','content':'Synthetic prompt.'}]
    assert len({e.generation_seed(turns,'prompt','voice',i) for i in range(1,6)})==5
    assert len({e.generation_seed(turns,'prompt','chat',i) for i in range(1,6)})==5
    assert e.generation_seed(turns,'prompt','chat',1)==e.generation_seed(turns,'prompt','chat',1)


def test_chat_uses_the_same_advisory_selection_and_preserves_counselor_guidance():
    prompt='How can I begin my assignment?'
    first=candidate("You're not alone. Open the document and write the first heading.",prompt,'ordinary')
    result=engine(dict(first),dict(first)).reply([{'role':'user','content':prompt}])
    assert result['reply'] and 'stock_reassurance' in result['advisory_issues']
    broken=candidate('Start with',prompt,'ordinary')
    result=engine(dict(broken),dict(broken)).reply([{'role':'user','content':prompt}])
    assert result['needs_review'] and not result['reply']


def test_valid_initial_reply_survives_rewrite_context_failure():
    prompt='How can I start my assignment?'
    first=candidate("You're not alone. Open the document and write the first heading.",prompt)
    result=engine(first,ValueError('Rewrite context cannot fit')).reply([{'role':'user','content':prompt}],delivery_mode='voice')
    assert result['reply'] and not result['needs_review']


def test_larger_budget_preserves_latest_message_when_old_context_is_removed():
    class Tensor:
        def __init__(self,n):self.shape=(1,n)
        def to(self,device):return self
    class Tokenizer:
        def apply_chat_template(self,turns,**kwargs):return {'input_ids':Tensor(sum(len(t['content']) for t in turns))}
    value=e.LocalCBT.__new__(e.LocalCBT);value.tokenizer=Tokenizer();value.device='cpu'
    latest={'role':'user','content':'x'*2400}
    inputs,dropped=value._input([{'role':'user','content':'old'*100},{'role':'assistant','content':'prior reply'},latest],'s'*100,e.generation_budget('voice'))
    assert dropped==2 and inputs['input_ids'].shape[1]==2500
    assert latest['content']=='x'*2400
