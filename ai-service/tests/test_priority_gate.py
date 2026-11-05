from concurrent.futures import ThreadPoolExecutor
import pytest
from app.model.priority_gate import PriorityGate
from app.model.text_transport import TextRuntime
from app.core.exceptions import TalkBusyError, ModelUnavailableError


def test_interactive_request_precedes_background_waiter_and_both_finish():
    gate = PriorityGate()
    assert gate.acquire()
    order = []
    def run(name, interactive):
        assert gate.acquire(timeout=2, interactive=interactive)
        try: order.append(name)
        finally: gate.release()
    with ThreadPoolExecutor(max_workers=2) as pool:
        background = pool.submit(run, 'journal', False)
        interactive = pool.submit(run, 'buddy', True)
        with gate.condition:
            assert gate.condition.wait_for(lambda: gate.interactive_waiters == 1, timeout=1)
        gate.release()
        interactive.result(timeout=3)
        background.result(timeout=3)
    assert order == ['buddy', 'journal']


def test_timed_out_interactive_waiter_does_not_block_future_journal():
    gate = PriorityGate()
    gate.acquire()
    assert not gate.acquire(timeout=.01, interactive=True)
    assert gate.interactive_waiters == 0
    gate.release()
    assert gate.acquire(timeout=.1)
    gate.release()


def test_journal_stages_release_admission_and_keep_same_request_results():
    runtime = TextRuntime.__new__(TextRuntime)
    runtime.buddy_enabled = True
    calls = []
    values = {'classify': {'safe': True}, 'emotions': {'emotion': 'joy'}, 'screening': {'status': 'ok'}, 'analyze': {'complete': True}}
    def call(operation, *args):
        calls.append((operation, args))
        return values[operation]
    runtime._call = call
    assert runtime.analyze('synthetic', 'en') == {'complete': True}
    assert [op for op, args in calls] == ['classify', 'emotions', 'screening', 'analyze']
    assert calls[-1][1] == ('synthetic', 'en', values['classify'], values['emotions'], values['screening'])


@pytest.mark.parametrize('error', [TalkBusyError('Talk has priority'), ModelUnavailableError('Screening failed')])
def test_interrupted_or_failed_screening_cannot_assemble_completed_analysis(error):
    runtime = TextRuntime.__new__(TextRuntime)
    runtime.buddy_enabled = True
    calls = []
    def call(operation, *args):
        calls.append(operation)
        if operation == 'screening': raise error
        return {'safe': True}
    runtime._call = call
    with pytest.raises(type(error)):
        runtime.analyze('synthetic')
    assert calls == ['classify', 'emotions', 'screening']
