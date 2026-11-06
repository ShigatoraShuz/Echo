"""Prepared regression cases. No model/environment initialization is required."""
import json
import queue
import threading
from types import SimpleNamespace
import pytest
from app.model.text_transport import TextRuntime
from app.buddy.nano_segments import bounded_sentences
from app.buddy.loading import safe_progress
from app.buddy.native_moss import runtime_inventory


def control_runtime(active=True):
    value=TextRuntime.__new__(TextRuntime)
    value.require_ready=lambda:None
    value.control_replies={};value.control_lock=threading.Lock();value.wire_lock=threading.Lock()
    value.responses=queue.Queue()
    def write(raw):
        packet=json.loads(raw)
        reply={'ok':active,'result':{'talkBusy':False,'journalBusy':True}}
        value.control_replies[packet['id']].put_nowait(reply)
    value.process=SimpleNamespace(stdin=SimpleNamespace(write=write,flush=lambda:None))
    return value


def test_heartbeat_does_not_enter_inference_reply_queue():
    runtime=control_runtime()
    runtime.responses.put({'id':'long-inference-still-running'})
    assert runtime.pulse('owned-session')=={'active':True}
    assert runtime.responses.get_nowait()=={'id':'long-inference-still-running'}
    assert not runtime.control_replies


def test_runtime_activity_and_failed_owner_have_separate_control_replies():
    assert control_runtime().runtime_status()['journalBusy'] is True
    with pytest.raises(Exception,match='BUDDY_TALK_NOT_ACTIVE'):
        control_runtime(False).pulse('wrong-owner')


def test_long_sentence_is_complete_ordered_and_bounded():
    text=('One complete phrase with Unicode café. '*30)+'Trailing fragment'
    parts=bounded_sentences([text],lambda value:len(value.encode('utf-8')),limit=90,max_chars=80)
    assert ''.join(parts)==text
    assert all(len(part)<=80 and len(part.encode('utf-8'))<=90 for part in parts)
    assert parts[-1].endswith('Trailing fragment')


def test_single_oversized_word_is_rejected_instead_of_truncated():
    with pytest.raises(RuntimeError,match='BUDDY_NANO_OVERSIZED_WORD'):
        bounded_sentences(['x'*600],len)


def test_expressive_progress_retains_only_safe_stage_and_hex_code():
    value=safe_progress({'component':'moss','state':'failed','attempt':1,'stage':'asset_verification',
        'code':'BUDDY_MOSS_NATIVE_EXIT_C0000374','prompt':'must never escape','path':'private'})
    assert value['stage']=='asset_verification'
    assert value['code']=='BUDDY_MOSS_NATIVE_EXIT_C0000374'
    assert 'prompt' not in value and 'path' not in value


def test_expressive_inventory_keeps_runtime_dlls_and_rejects_missing_codec():
    names=['artifacts/moss-v15-q4_k_m.gguf','artifacts/moss_tts_audio_encoder_f16.gguf',
        'artifacts/moss_tts_audio_decoder_f16.gguf','build/bin/Release/llama-moss-tts.exe','build/bin/Release/ggml-cuda.dll']
    records=[{'path':name} for name in names+['artifacts/moss-v15-f16.gguf','build/bin/Release/llama-moss-tts.pdb']]
    assert [entry['path'] for entry in runtime_inventory({'files':records})]==names
    with pytest.raises(RuntimeError,match='BUDDY_MOSS_ASSET_MISSING'):
        runtime_inventory({'files':records[1:]})
