"""Buddy-specific gates; no inference weights or account data are needed."""
import json
import threading
from pathlib import Path
from types import SimpleNamespace
import pytest
from app.buddy.config import ADAPTER_SHA, VOICE_SHA
from app.buddy.runtime import BuddyRuntime
from app.buddy.sentences import sentences, batches
from app.core.exceptions import ModelUnavailableError, TalkCancelledError

def test_sentence_schedule_and_complete_coverage():
    text = 'Dr. Smith has 1.5 hours. "Try this." Then wait! Is that okay? Five. Six. Seven. Trailing fragment'
    parts = sentences(text)
    assert "".join(parts) == text
    assert [len(group) for group in batches(parts)] == [1, 1, 3, 3]
    assert parts[-1] == "Trailing fragment"

def test_exact_selected_identity_is_pinned():
    assert ADAPTER_SHA == "6bfe92fc0ba316997a18abcb7c79a1fda7cec608bce07baaa7719bfb47c7c04e"
    assert VOICE_SHA == "3842d142fe4570197a059261467b806ccc36d2d35d4044255dc0d224be03a08f"

def stub():
    runtime = BuddyRuntime.__new__(BuddyRuntime)
    runtime.core = SimpleNamespace(lock=threading.RLock(), instance=None, provenance=lambda name: {"name": name})
    runtime.cpu_classifier = SimpleNamespace(classify=lambda text: {"suicidal_language_flag": False})
    runtime._classifier = lambda: runtime.cpu_classifier
    return runtime

def test_support_screen_runs_before_any_generation():
    runtime = stub()
    runtime.cpu_classifier.classify = lambda text: {"suicidal_language_flag": True}
    runtime._worker = lambda *args: pytest.fail("Screened turn must not reach CBT")
    assert runtime.generate([{"role": "user", "content": "Synthetic"}])["supportRequired"]

def test_withheld_draft_never_becomes_an_answer():
    runtime = stub()
    runtime._worker = lambda *args: {"withheld": True, "reply": None, "issues": ["incomplete"]}
    with pytest.raises(ModelUnavailableError, match="WITHHELD"):
        runtime.generate([{"role": "user", "content": "Synthetic"}])

def test_chat_and_talk_share_approval_and_context():
    runtime = stub()
    runtime.owner = "session"; runtime.ready = True
    seen = []
    def worker(kind, payload, cancelled):
        seen.append(payload["messages"])
        return {"reply": "One complete answer.", "quality": {"auto_format_preserved_content": True},
                "model": {"modelVersion": ADAPTER_SHA}, "seconds": .2}
    runtime._worker = worker
    history = [{"role": "user", "content": "First"}, {"role": "assistant", "content": "Prior."},
               {"role": "user", "content": "List steps I could take."}]
    assert runtime.generate(history) == runtime.chat("session", history)
    assert seen == [history, history]

def test_cancelled_result_cannot_publish():
    runtime = stub()
    cancelled = threading.Event()
    def worker(*args):
        cancelled.set()
        return {"reply": "Stale.", "seconds": .1}
    runtime._worker = worker
    with pytest.raises(TalkCancelledError):
        runtime.generate([{"role": "user", "content": "Synthetic"}], cancelled)

def test_scheduler_releases_only_optional_buddy_workers():
    runtime = stub(); runtime.ready = True
    closed = []
    runtime.workers = {kind: SimpleNamespace(close=lambda k=kind: closed.append(k))
                       for kind in ("cbt", "nano", "whisper")}
    runtime.evict()
    assert closed == ["cbt", "nano"] and set(runtime.workers) == {"whisper"}
    assert not runtime.ready

def test_prepare_modes_preserve_prepared_text():
    runtime = stub(); runtime.owner = "session"
    for mode in ("sentences_2_then_3", "buffered"):
        result = runtime.dispatch("session", {"task": "prepare", "text": "First. Second. Third. Fourth. Fifth. Sixth.",
                                              "language": "English", "speechMode": mode})
        assert "".join(part for group in result["groups"] for part in group) == result["preparedText"]
        if mode == "sentences_2_then_3":
            assert list(map(len, result["groups"])) == [1, 1, 3, 1]

def test_no_production_payload_file_writes():
    # The worker uses only waveform encoding; Nano's file-producing API is never invoked.
    source = (Path(__file__).parents[1] / "app/buddy/worker.py").read_text("utf-8-sig")
    assert ".synthesize(" not in source
    assert "sf.write(" not in source
    assert "write_text(" not in source

def test_v3_delivery_strips_rejected_drafts(monkeypatch):
    from app.buddy import worker, gpu_memory
    monkeypatch.setattr(gpu_memory,"require_headroom",lambda *a,**kw:{"freeBytes":8*1024**3})
    engine = SimpleNamespace(reply=lambda messages: {"needs_review": True, "reply": None,
        "_raw_reply": "Rejected private draft", "issues": ["incomplete"]})
    monkeypatch.setattr(worker, "ENGINE", engine)
    monkeypatch.setattr(worker, "MODEL_IDENTITY", {"modelVersion": ADAPTER_SHA})
    result = worker.cbt({"messages": [{"role": "user", "content": "Synthetic"}]})
    assert result["withheld"] and "Rejected private draft" not in json.dumps(result)

def test_speech_failure_does_not_select_a_fallback_worker():
    runtime = stub(); runtime.workers = {}; runtime.ready = True
    runtime.evict = lambda: None
    from app.buddy import runtime as module
    original = module.Process
    calls = []
    class Failed:
        def __init__(self, python, kind, cancelled=None): calls.append(kind)
        def call(self, payload, cancelled): raise ModelUnavailableError("BUDDY_NANO_FAILED")
        def close(self): pass
    module.Process = Failed
    try:
        with pytest.raises(ModelUnavailableError):
            runtime._worker("nano", {"texts": ["Complete."]})
        assert calls == ["nano"]
    finally:
        module.Process = original


@pytest.mark.parametrize("mode", ["echo", "cancel"])
def test_real_resident_process_protocol_and_cancellation(monkeypatch, mode):
    import subprocess, sys
    from app.buddy import process as module
    real = subprocess.Popen
    children = []
    monkeypatch.setattr(module, "check_environment", lambda *a, **k: None)
    def spawn(args, **kwargs):
        assert "AI_SERVICE_TOKEN" not in kwargs["env"]
        app_root = str(Path(__file__).resolve().parents[1])
        code = "import sys,time;sys.path.insert(0," + repr(app_root) + ")\\n"
        code += "import app.buddy.worker as w\\nw.KIND='nano'\\ndef run(p):\\n import numpy\\n"
        code += " time.sleep(10)\\n return p\\n" if mode == "cancel" else " return p\\n"
        code += "w.nano=run\\nw.main()\\n"
        code = code.replace(chr(92) + "n", chr(10))
        child = real([sys.executable,"-I","-B","-u","-c",code], **kwargs)
        children.append(child)
        return child
    monkeypatch.setattr(module.subprocess, "Popen", spawn)
    worker = module.Process(Path(sys.executable), "nano")
    try:
        if mode == "echo":
            assert worker.call({"check":True}) == {"check":True}
            pid = worker.process.pid
            assert worker.call({"texts":["One sentence."]}) == {"texts":["One sentence."]}
            assert worker.process.pid == pid
        else:
            cancelled = threading.Event()
            threading.Timer(.1, cancelled.set).start()
            with pytest.raises(TalkCancelledError):
                worker.call({"check":True}, cancelled)
            assert worker.process.poll() is not None
    finally:
        worker.close()

def test_environment_access_error_is_actionable_and_no_worker_launches(monkeypatch):
    from app.buddy import process as module
    launches = []
    def check(args, **kwargs):
        launches.append(args)
        return SimpleNamespace(communicate=lambda **kw: (b"", b"ImportError: DLL load failed: Access is denied."),
                               returncode=1, stderr=SimpleNamespace(close=lambda: None))
    monkeypatch.setattr(module, "spawn_owned", check)
    with pytest.raises(ModelUnavailableError, match="BUDDY_CBT_ENV_ACCESS_DENIED"):
        module.Process(Path("configured-python"), "cbt")


    assert len(launches) == 1 and launches[0][-2] == "-c"

@pytest.mark.parametrize("corrupt", [None, "wave", "metadata", "partial"])
def test_reference_reuse_or_corruption_fails_closed_without_replacement(monkeypatch, tmp_path, corrupt):
    import hashlib
    from app.buddy import config, checkpoints
    root = tmp_path / "assets"; module = tmp_path / "module"
    (root / "voices/buddy").mkdir(parents=True); module.mkdir()
    sample = root / "voices/buddy/sample.wav"; sample.write_bytes(b"synthetic-reference-identity")
    original = hashlib.sha256(sample.read_bytes()).hexdigest()
    metadata = root / "voices/buddy/metadata.json"
    metadata.write_text(json.dumps({"sha256": original, "version": 1}))
    (module / "assets.lock.json").write_text(json.dumps({"files": {}}))
    (module / 'nano_vendor').mkdir()
    (module / 'nano_vendor/source.py').write_bytes(b'synthetic-source')
    (module / 'nano-source.lock.json').write_text(json.dumps({'source.py':hashlib.sha256(b'synthetic-source').hexdigest()}))
    monkeypatch.setattr(config, "HERE", module)
    monkeypatch.setattr(config, "VOICE_SHA", original)
    monkeypatch.setattr(config, "paths", lambda: {"root": root})
    monkeypatch.setattr(checkpoints, "validate_checkpoint", lambda path: None)
    assert config.verify_nano() == root
    assert config.verify_nano() == root  # Reload reads the same persisted identity.
    if corrupt == "wave": sample.write_bytes(b"corrupt-reference")
    if corrupt == "metadata": metadata.write_text('{"version":1,"sha256":"different"}')
    if corrupt == "partial": metadata.unlink()
    before = sample.read_bytes()
    if corrupt:
        with pytest.raises((ValueError, FileNotFoundError)):
            config.verify_nano()
    assert sample.read_bytes() == before


def test_corrupt_adopted_policy_is_rejected(monkeypatch, tmp_path):
    from app.buddy import config
    (tmp_path / "v3").mkdir()
    policy = tmp_path / "v3/formatting.py"; policy.write_bytes(b"verified source")
    import hashlib
    expected = hashlib.sha256(policy.read_bytes()).hexdigest()
    (tmp_path / "v3-source.lock.json").write_text(json.dumps({
        "policy":"echo_cbt_mixed_standalone_complete_steps_v3_20261101",
        "files":{"formatting.py":expected}}))
    monkeypatch.setattr(config,"HERE",tmp_path)
    config.verify_policy()
    policy.write_bytes(b"changed policy")
    with pytest.raises(ValueError,match="BUDDY_POLICY_INTEGRITY_FAILED"):
        config.verify_policy()

def test_new_buddy_policy_does_not_weaken_non_buddy_code_integrity(tmp_path):
    from app.model.core import CoreRuntime
    (tmp_path/"manifest.json").write_text(json.dumps({"files":[],"inferenceCode":[{
        "path":"ai-service/app/vendor/e4/inference.py","sha256":"0"*64}]}))
    with pytest.raises(ModelUnavailableError,match="Inference code differs"):
        CoreRuntime(SimpleNamespace(models_root=str(tmp_path),queue_limit=1),text_only=True)

def test_obsolete_buddy_inventory_does_not_weaken_shared_base_integrity(tmp_path):
    from app.model.core import CoreRuntime
    file=tmp_path/"cbt/base/config.json";file.parent.mkdir(parents=True);file.write_bytes(b"corrupt")
    (tmp_path/"manifest.json").write_text(json.dumps({"inferenceCode":[{
        "path":"ai-service/app/vendor/cbt/v5/obsolete.py","sha256":"0"*64}],
        "files":[{"path":"cbt/base/config.json","bytes":7,"sha256":"0"*64}]}))
    with pytest.raises(ModelUnavailableError,match="Model checksum mismatch"):
        CoreRuntime(SimpleNamespace(models_root=str(tmp_path),queue_limit=1),text_only=True)


def test_driver_headroom_includes_other_workers_and_has_no_local_fallback(monkeypatch):
    from app.buddy import gpu_memory
    fake_torch=SimpleNamespace(cuda=SimpleNamespace(
        current_device=lambda:0,get_device_properties=lambda index:SimpleNamespace(uuid="GPU-synthetic"),
        mem_get_info=lambda:(16*1024**3,16*1024**3)))
    calls=[]
    def query(identity,index):
        calls.append((identity,index))
        return {"freeBytes":8*1024**3,"totalBytes":16*1024**3}
    monkeypatch.setattr(gpu_memory,"_read_nvml",query)
    assert gpu_memory.require_headroom(fake_torch,3*1024**3)["freeBytes"]==8*1024**3
    assert calls==[("GPU-synthetic",0)]
    monkeypatch.setattr(gpu_memory,"_read_nvml",lambda *a:{"freeBytes":1024**3,"totalBytes":16*1024**3})
    with pytest.raises(ModelUnavailableError,match="INSUFFICIENT_GPU_HEADROOM"):
        gpu_memory.require_headroom(fake_torch)
    def failed(*args): raise OSError("Driver unavailable")
    monkeypatch.setattr(gpu_memory,"_read_nvml",failed)
    with pytest.raises(ModelUnavailableError,match="GPU_MEMORY_UNAVAILABLE"):
        gpu_memory.require_headroom(fake_torch)


def test_explicit_unload_releases_all_buddy_workers():
    runtime = stub()
    closed = []
    runtime.owner = None
    runtime.ready = True
    runtime.workers = {kind: SimpleNamespace(close=lambda kind=kind: closed.append(kind))
                       for kind in ("cbt", "nano", "whisper")}
    assert runtime.dispatch("page", {"task": "unload"}) == {"unloaded": True}
    assert sorted(closed) == ["cbt", "nano", "whisper"]
    assert not runtime.workers and not runtime.ready and runtime.cpu_classifier is None


def test_unload_does_not_disrupt_active_owner():
    from app.core.exceptions import TalkBusyError
    runtime = stub()
    runtime.owner = "another-session"
    runtime.evict = lambda: pytest.fail("Active owner must be preserved")
    with pytest.raises(TalkBusyError):
        runtime.dispatch("page", {"task": "unload"})
