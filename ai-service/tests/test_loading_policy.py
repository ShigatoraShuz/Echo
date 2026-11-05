import threading
import pytest
from app.buddy.loading import safe_progress, PREPARATION_SECONDS, COMPONENT_SECONDS, RETRY_DELAYS
from app.buddy.process import Process
from app.core.exceptions import ModelUnavailableError

def test_outer_budget_covers_all_attempts_and_normal_generation_is_not_extended():
    assert PREPARATION_SECONDS > sum(COMPONENT_SECONDS.values())*5+sum(RETRY_DELAYS)*3+180

@pytest.mark.parametrize('value',[None,{}, {'component':'secret-path','state':'loading','attempt':1}, {'component':'cbt','state':'loading','attempt':True}, {'component':'cbt','state':'loading','attempt':6}])
def test_invalid_progress_is_rejected(value):assert safe_progress(value) is None

def test_progress_fields_are_allowlisted_and_codes_cannot_expose_paths():
    value=safe_progress({'component':'nano','state':'failed','attempt':1,'path':'C:/private','code':'C:/private','elapsedSeconds':float('nan'),'prompt':'private','correlationId':'token'})
    assert value=={'component':'nano','state':'failed','attempt':1,'maxAttempts':5}

def test_expired_preparation_deadline_never_sends_a_worker_request():
    process=Process.__new__(Process);process.kind='nano';closed=[];process.close=lambda:closed.append(True)
    with pytest.raises(ModelUnavailableError,match='LOAD_TIMEOUT'):process.call({'texts':['warm']},deadline=-1)
    assert closed==[True]

def test_preparation_endpoint_keeps_internal_auth_and_does_not_take_inference_lock(monkeypatch):
    from types import SimpleNamespace
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.routes.core import router
    calls=[]
    monkeypatch.setattr('app.core.security.get_settings',lambda:SimpleNamespace(ai_service_token='x'*32))
    app=FastAPI();app.include_router(router)
    app.state.model_runtime=SimpleNamespace(analyze=lambda:None,preparation_status=lambda:calls.append(True) or {'preparation':None})
    with TestClient(app) as client:
        assert client.get('/v2/preparation').status_code==401
        assert calls==[]
        response=client.get('/v2/preparation',headers={'Authorization':'Bearer '+'x'*32})
        assert response.status_code==200 and response.json()=={'preparation':None} and calls==[True]

@pytest.mark.parametrize('error,suffix',[
 (ValueError('No loadable model checkpoint in C:/private'),'ASSET_INVALID'),
 (FileNotFoundError('C:/private/model.safetensors'),'ASSET_MISSING'),
 (ImportError('private import details'),'ENV_IMPORT_FAILED'),
 (PermissionError('C:/private'),'ENV_ACCESS_DENIED'),
])
def test_invalid_checkpoint_and_environment_errors_are_permanent_sanitized_codes(error,suffix):
    from app.buddy.worker import loading_error_code
    from app.buddy.loading import retryable
    code=loading_error_code(error,'nano',checking=True)
    assert code=='BUDDY_NANO_'+suffix and not retryable(code)
    assert 'private' not in code

def test_parallel_progress_frames_remain_complete_ndjson(monkeypatch):
    import json,time
    from concurrent.futures import ThreadPoolExecutor
    from types import SimpleNamespace
    from app.model import text_worker
    chunks=[]
    class Buffer:
        def write(self,data):
            middle=len(data)//2;chunks.append(data[:middle]);time.sleep(.001);chunks.append(data[middle:])
        def flush(self):pass
    monkeypatch.setattr(text_worker.sys,'__stdout__',SimpleNamespace(buffer=Buffer()))
    with ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(lambda i:text_worker.emit({'event':'preparation','sequence':i}),range(40)))
    frames=[json.loads(line) for line in b''.join(chunks).splitlines()]
    assert len(frames)==40 and {frame['sequence'] for frame in frames}==set(range(40))
