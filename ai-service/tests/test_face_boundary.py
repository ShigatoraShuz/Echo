import base64
from pathlib import Path
import pytest
from app.model.core import CoreRuntime
from app.model.face_transport import FaceRuntime
from app.core.exceptions import ModelUnavailableError


def test_core_face_uses_memory_transport_and_closes_it(tmp_path, monkeypatch):
    runtime = CoreRuntime.__new__(CoreRuntime)
    runtime.root = tmp_path / 'models'
    seen = []
    class Fake:
        def __init__(self, root): assert root == runtime.root
        def predict(self, encoded):
            seen.append(encoded)
            raise ModelUnavailableError('FACE_INFERENCE_FAILED')
        def close(self): seen.append('closed')
    monkeypatch.setattr('app.model.face_transport.FaceRuntime', Fake)
    with pytest.raises(ModelUnavailableError):
        runtime.face(base64.b64encode(b'synthetic').decode())
    assert seen == [base64.b64encode(b'synthetic').decode(), 'closed']
    assert list(tmp_path.iterdir()) == []


def test_face_rejects_invalid_and_oversized_payload_before_starting_child(tmp_path, monkeypatch):
    runtime = FaceRuntime(tmp_path)
    monkeypatch.setattr(runtime, 'verify', lambda: pytest.fail('Invalid input must not reach model package'))
    for value in ['', '%%%not-base64', base64.b64encode(b'x' * (2 * 1024 * 1024 + 1)).decode()]:
        with pytest.raises(ValueError): runtime.predict(value)


def test_missing_or_tampered_package_is_rejected(tmp_path):
    runtime = FaceRuntime(tmp_path)
    with pytest.raises(ModelUnavailableError, match='FACE_PACKAGE_UNAVAILABLE'): runtime.verify()
    runtime.root.mkdir()
    (runtime.root/'package_checksums.json').write_text('{}')
    with pytest.raises(ModelUnavailableError, match='FACE_PACKAGE_UNAVAILABLE'): runtime.verify()


@pytest.mark.parametrize('mode', ['ok', 'timeout', 'invalid', 'failure'])
def test_capture_stays_in_stdin_and_cleanup_releases_admission(tmp_path, monkeypatch, mode):
    import io, json, subprocess
    from types import SimpleNamespace
    runtime = FaceRuntime(tmp_path)
    pins = {'selected_model.joblib': 'a' * 64}
    monkeypatch.setattr(runtime, 'verify', lambda: pins)
    monkeypatch.setenv('SUPABASE_SERVICE_ROLE_KEY', 'private-test-sentinel')
    monkeypatch.setenv('AI_SERVICE_TOKEN', 'private-ai-test-sentinel')
    closed = []
    def communicate(*, input, timeout):
        assert input == b'synthetic-image-bytes' and timeout == 90
        if mode == 'timeout': raise subprocess.TimeoutExpired('owned-child', 90)
        output = [] if mode == 'invalid' else {'schemaVersion':'echo-face-expression-v1','status':'unavailable','reason':'no_usable_face','modelFingerprint':'a'*64}
        return json.dumps(output).encode(), None
    process = SimpleNamespace(stdin=io.BytesIO(),stdout=io.BytesIO(),communicate=communicate,returncode=1 if mode == 'failure' else 0)
    def spawn(args, **kwargs):
        assert 'synthetic-image-bytes' not in str(args)
        assert 'SUPABASE_SERVICE_ROLE_KEY' not in kwargs['env']
        assert 'AI_SERVICE_TOKEN' not in kwargs['env']
        assert kwargs['env']['CUDA_VISIBLE_DEVICES'] == '-1'
        assert kwargs['stdin'] == subprocess.PIPE
        return process
    monkeypatch.setattr('app.model.face_transport.spawn_owned', spawn)
    monkeypatch.setattr('app.model.face_transport.terminate_owned', lambda p: closed.append(p))
    payload = base64.b64encode(b'synthetic-image-bytes').decode()
    if mode == 'ok': assert runtime.predict(payload)['reason'] == 'no_usable_face'
    else:
        with pytest.raises(ModelUnavailableError): runtime.predict(payload)
    assert closed == [process] and runtime.process is None
    assert runtime.lock.acquire(blocking=False)
    runtime.lock.release()
    assert list(tmp_path.iterdir()) == []
