import sys
from pathlib import Path
import pytest
sys.path.insert(0,str(Path(__file__).parents[2]/'app/buddy/v3'))
import echo_cbt_standalone as e
import formatting as f

@pytest.mark.parametrize('utterance,count',[('Give me 1 tip',1),('Give me three examples',3),('List 7 practical ways',7),('Give me ten items',10),('Give me 25 tips',10),('Magbigay ng sampung paraan',10),('List mga tatlo hakbang',3),('List steps',3)])
def test_count_policy(utterance,count):
    if count is None:
        assert e.requested_item_count(utterance) is None
    else:
        assert e.role(utterance)=='steps'
        assert e.list_target(utterance)==count

def test_unrelated_numbers_do_not_request_list():
    assert e.requested_item_count('I sleep 5 hours and have 3 exams') is None
    assert e.role('I feel anxious for 10 minutes')=='ordinary'
    assert e.requested_item_count('I tried 3 coping strategies and none helped') is None
    assert e.requested_item_count('Give me 5 minutes to explain') is None
    assert e.list_target('Give me twenty-five tips')==10
    assert e.list_target('List one hundred examples')==10
    assert e.list_target('List 5 benefits of taking breaks')==5

def test_count_quality_including_single_and_cap():
    for n in (1,3,7,10):
        answer='\n'.join(f'{i}. Start useful action number {i} now.' for i in range(1,n+1))
        assert 'requested_step_count_mismatch' not in e.quality_issues(answer,f'Give me {n} tips','steps',False)
    assert 'requested_step_count_mismatch' in e.quality_issues('1. Start now.','Give me ten tips','steps',False)
    assert 'duplicate_list_item' in e.quality_issues('1. Start now.\n2. Start now.','Give me two tips','steps',False)
    assert 'duplicate_list_item' in e.quality_issues('Here are two tips: 1. Start now. 2. Start now.','Give me two tips','steps',False)
    assert 'incomplete_list_item' in e.quality_issues('1. Start with 2. Finish this.','Give me two tips','steps',False)
    assert 'incomplete_list_item' in e.quality_issues('1. Start with\n2. Finish this.','Give me two tips','steps',False)
    raw='Here is one item: 1. Choose one task and open the document.'
    formatted=f.format_chat_response(raw,role='steps',config=e.style()['chat_output_format'])
    assert '\n1. ' in formatted
    assert ''.join(raw.split())==''.join(formatted.split())
    body='\n'.join(f'{i}. Complete distinct action {i}.' for i in range(1,11))
    limited=e.list_limit_notice('If you feel unsafe, get immediate support. Here are 12 practical steps:\n'+body,'Give me 12 steps')
    assert 'maximum of ten' in limited and 'Here are ten practical steps' in limited
    assert 'If you feel unsafe, get immediate support.' in limited
    assert limited.endswith(body)

def test_reviewer_guidance_and_voice_list_parity():
    for mode in ('chat','voice'):
        prompt=e.system_prompt('Give me 12 steps to manage schoolwork',delivery_mode=mode)
        assert 'exactly 10' in prompt and 'limiting this reply to ten' in prompt
        ordinary=e.system_prompt('How can I start feeling better after weeks of emptiness?',delivery_mode=mode)
        assert 'Do not diagnose' in ordinary and 'Do not force questions' in ordinary

def test_vague_offer_to_explore_is_not_practical_help():
    assert 'generic_advice_without_starting_action' in e.quality_issues('It may help to explore strategies for your well-being.','How can I start feeling better?','ordinary',False)
    assert 'generic_advice_without_starting_action' not in e.quality_issues('Choose one task and write its smallest next action.','How can I start?','ordinary',False)
    assert e.usable_start('Start by listing your tasks and prioritize the one due soonest.')
    assert e.usable_start('Reflect on what changed this week and speak with a counselor.')
    assert e.usable_start('Pay attention to when your energy changes during a daily activity.')
    assert e.usable_start('Observe one moment when a task feels harder.')
    assert e.usable_start('Start identifying a pattern in when your motivation changes.')
    assert 'stock_reassurance' in e.quality_issues("You're not alone. Choose one task to begin.",'How can I start?','ordinary',False)
    assert 'stacked_generic_advice' in e.quality_issues('Write your thoughts. Another idea is to try hobbies. Remember to prioritize sleep.','How can I start?','ordinary',False)

def test_inline_lists_cannot_bypass_ordinary_format_checks():
    assert 'extreme_structural_overload' in e.quality_issues('Try these: 1. Write tasks. 2. Choose one.','How can I start?','ordinary',False)
    assert 'extreme_structural_overload' in e.quality_issues('Here is how to begin: 1. Write your goal.','How can I start?','ordinary',False)

def test_reflective_questions_do_not_hide_a_complete_ending():
    text='What supports the fear? What evidence points the other way? Write one example of each to compare.'
    assert e.sentence_boundary(text,'ordinary')
    assert 'unfinished_structure_or_clause' not in e.quality_issues(text,'How can I work with my fear?','ordinary',False)

def test_persistence_support_check_is_specific_to_persistent_concern():
    prompt='For weeks I feel empty and no longer enjoy things. How can I start?'
    assert e.persistent_concern(prompt)
    assert not e.persistent_concern('I feel stressed by homework today.')
    assert 'persistent_distress_support_missing' in e.quality_issues('Choose a hobby to try.',prompt,'ordinary',False)
    assert e.persistent_support_covered('Since this has lasted weeks, consider talking with a counselor.')
    assert e.persistent_support_covered('For this prolonged period of low enjoyment, speak with a counselor.')
    assert 'persistent_advice_without_concrete_start' in e.quality_issues('Engage in activities you used to enjoy. Since this has lasted weeks, speak with a counselor.',prompt,'ordinary',False)
    assert 'persistent_advice_without_concrete_start' not in e.quality_issues('Note one activity that feels harder and when your energy changes. Since this has lasted weeks, speak with a counselor.',prompt,'ordinary',False)
