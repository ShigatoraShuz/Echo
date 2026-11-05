"""llama bridge tests: no real model assets or user content."""
import json
from types import SimpleNamespace
import pytest
from app.buddy.llama_backend import GenerateBridge, Server
from app.core.exceptions import ModelUnavailableError


class FakeServer:
    context = 4096
    def __init__(self, events):
        self.events, self.idle_count, self.closed_stream = events, 0, False
    def stream(self, payload):
        self.payload = payload
        try:
            yield from self.events
        finally:
            self.closed_stream = True
    def idle(self):
        self.idle_count += 1


def generate(server, stopper=lambda *args: False, maximum=6):
    import torch
    bridge = GenerateBridge(server, torch)
    return bridge.generate(input_ids=torch.tensor([[10, 11]]), attention_mask=torch.ones(1,2),
        max_new_tokens=maximum, stopping_criteria=stopper, temperature=.7, top_p=.9, top_k=40,
        repetition_penalty=1.1, eos_token_id=[99])


def test_generation_preserves_prompt_ids_stopping_and_drains_slot():
    server = FakeServer([{"tokens":[12]}, {"tokens":[13]}, {"tokens":[14]}, {"stop":True,"tokens":[12,13,14]}])
    output = generate(server, lambda sequence, _: sequence.shape[1] == 4)
    assert output.sequences.tolist() == [[10,11,12,13]]
    assert server.closed_stream and server.idle_count == 1
    assert server.payload["prompt"] == [10,11]
    assert server.payload["repeat_last_n"] == 4096
    assert server.payload["min_p"] == 0
    assert server.payload["samplers"] == ["penalties","temperature","top_k","top_p"]


def test_terminal_cumulative_tokens_are_not_duplicated():
    server = FakeServer([{"tokens":[12,13]}, {"stop":True,"tokens":[12,13]}])
    assert generate(server).sequences.tolist() == [[10,11,12,13]]


@pytest.mark.parametrize("events,code", [([{"tokens":[12]}],"STREAM_INCOMPLETE"),
    ([{"tokens":["unsafe"]}],"TOKEN_PROTOCOL_MISMATCH"),
    ([{"tokens":[12],"truncated":True}],"CONTEXT_MISMATCH"),
    ([{"tokens":[1,2,3,4,5,6,7]}],"TOKEN_LIMIT_MISMATCH")])
def test_protocol_faults_never_produce_an_answer(events,code):
    server = FakeServer(events)
    with pytest.raises(ModelUnavailableError,match=code):
        generate(server)
    assert server.closed_stream and server.idle_count == 0


def test_eos_stops_without_publishing_additional_tokens():
    server = FakeServer([{"tokens":[12,99,13]}])
    assert generate(server).sequences.tolist() == [[10,11,12,99]]


def test_context_overflow_is_rejected_before_generation():
    server = FakeServer([]);server.context=3
    with pytest.raises(ModelUnavailableError,match="CONTEXT_MISMATCH"):
        generate(server)
    assert not hasattr(server,"payload")


def test_connection_rejects_unknown_routes_before_network():
    server = Server.__new__(Server)
    server.closed=False;server.process=SimpleNamespace(poll=lambda:None)
    with pytest.raises(ModelUnavailableError,match="TRANSPORT_INVALID"):
        server.connection("GET","http://outside.invalid/private")


def test_private_http_uses_no_redirect_or_proxy_handler(monkeypatch):
    from app.buddy import llama_backend
    calls=[]
    class Connection:
        def __init__(self,host,port,timeout):calls.append((host,port,timeout))
        def request(self,*args):calls.append(args)
        def getresponse(self):return SimpleNamespace(status=302)
        def close(self):calls.append("closed")
    monkeypatch.setattr(llama_backend.http.client,"HTTPConnection",Connection)
    server=Server.__new__(Server);server.closed=False;server.process=SimpleNamespace(poll=lambda:None)
    server.port=12345;server.token="synthetic-private-token"
    with pytest.raises(ModelUnavailableError,match="HTTP_FAILED"):
        server.connection("GET","/health")
    assert calls[0][0]=="127.0.0.1" and calls[-1]=="closed"


def artifact_fixture(tmp_path, monkeypatch):
    from app.buddy import config
    import hashlib
    here=tmp_path/"Echo/ai-service/app/buddy";here.mkdir(parents=True)
    root=tmp_path/"Echo/models";artifact=root/"llama/artifacts/synthetic";artifact.mkdir(parents=True)
    model=artifact/"model.gguf";model.write_bytes(b"synthetic GGUF")
    runtime=root/"llama/runtime/synthetic";binary=runtime/"bin";binary.mkdir(parents=True)
    files=[]
    for name in ("llama-server.exe","llama.dll","ggml.dll","ggml-base.dll","ggml-cuda.dll","ggml-cpu-x64.dll"):
        path=binary/name;path.write_bytes(b"synthetic binary")
        files.append({"path":"bin/"+name,"bytes":path.stat().st_size,"sha256":config.digest(path)})
    revision="a"*40;assets=[{"name":"runtime.zip","sha256":"archive identity"}]
    runtime_lock={"tag":"synthetic","commit":revision,"assets":assets}
    (root.parent/"scripts").mkdir()
    (root.parent/"scripts/llama-runtime.lock.json").write_text(json.dumps(runtime_lock))
    installed=runtime/"manifest.json";installed.write_text(json.dumps({"commit":revision,"assets":assets,"files":files}))
    tokenizer=root/"buddy/adapter";tokenizer.mkdir(parents=True)
    source_files=[]
    for name in ("tokenizer.json","tokenizer_config.json","chat_template.jinja"):
        path=tokenizer/name;path.write_bytes(b"synthetic tokenizer")
        source_files.append({"path":"buddy/adapter/"+name,"bytes":path.stat().st_size,"sha256":config.digest(path)})
    source={"files":source_files,"adapterSHA256":config.ADAPTER_SHA,"adapterConfigSHA256":config.ADAPTER_CONFIG_SHA}
    source_identity=hashlib.sha256(json.dumps(source,sort_keys=True).encode()).hexdigest()
    (artifact/"source-identity.json").write_text(json.dumps({**source,"identity":source_identity,"baseBytes":0}))
    lock={"artifact":"llama/artifacts/synthetic","sourceIdentity":source_identity,"llamaCommit":revision,
          "runtimeInventorySHA256":hashlib.sha256(json.dumps({"commit":revision,"assets":assets,"files":sorted(files,key=lambda x:x["path"])},sort_keys=True).encode()).hexdigest(),
          "model":{"path":"model.gguf","bytes":model.stat().st_size,"sha256":config.digest(model)}}
    (here/"cbt-gguf.lock.json").write_text(json.dumps(lock))
    manifest={"model":"mixed_epochs_2","base":"SeaLLMs/SeaLLMs-v3-7B-Chat","adapterSHA256":config.ADAPTER_SHA,
              "adapterConfigSHA256":config.ADAPTER_CONFIG_SHA,"sourceIdentity":source_identity,"llamaCommit":revision}
    (artifact/"manifest.json").write_text(json.dumps(manifest))
    monkeypatch.setattr(config,"HERE",here)
    return config,artifact,runtime,manifest


def test_pinned_artifact_reuses_exact_model_only(tmp_path,monkeypatch):
    config,artifact,runtime,_=artifact_fixture(tmp_path,monkeypatch)
    model,executable,lock=config.verify_cbt_gguf()
    assert model==artifact/"model.gguf" and executable==runtime/"bin/llama-server.exe"
    (artifact/"model.gguf").write_bytes(b"changed GGUF!!")
    with pytest.raises(ValueError,match="GGUF_INTEGRITY"):
        config.verify_cbt_gguf()


def test_wrong_adapter_provenance_cannot_start(tmp_path,monkeypatch):
    config,artifact,_,manifest=artifact_fixture(tmp_path,monkeypatch)
    manifest["adapterSHA256"]="different adapter"
    (artifact/"manifest.json").write_text(json.dumps(manifest))
    with pytest.raises(ValueError,match="GGUF_IDENTITY"):
        config.verify_cbt_gguf()


def test_corrupt_runtime_library_prevents_loading(tmp_path,monkeypatch):
    config,_,runtime,_=artifact_fixture(tmp_path,monkeypatch)
    (runtime/"bin/ggml-cuda.dll").write_bytes(b"modified CUDA dll")
    with pytest.raises(ValueError,match="LLAMA_INTEGRITY"):
        config.verify_cbt_gguf()


def test_runtime_inventory_cannot_read_outside_root(tmp_path,monkeypatch):
    config,_,runtime,_=artifact_fixture(tmp_path,monkeypatch)
    manifest=json.loads((runtime/"manifest.json").read_text());manifest["files"][0]["path"]="../../outside"
    (runtime/"manifest.json").write_text(json.dumps(manifest))
    with pytest.raises(ValueError,match="LLAMA_INTEGRITY"):
        config.verify_cbt_gguf()


def test_effective_sampler_settings_must_match_with_float_tolerance():
    from app.buddy.llama_backend import verify_sampling
    verify_sampling({"temperature":.7,"samplers":["temperature","top_k"]},
                    {"temperature":.699999988,"samplers":["temperature","top_k"]})
    with pytest.raises(ModelUnavailableError,match="SAMPLER_MISMATCH"):
        verify_sampling({"temperature":.7},{"temperature":.8})
    with pytest.raises(ModelUnavailableError,match="SAMPLER_MISMATCH"):
        verify_sampling({"samplers":["temperature","top_k"]},{"samplers":["top_k","temperature"]})


def test_residency_requires_complete_gpu_offload():
    server=Server.__new__(Server)
    server.total_layers=29;server.offloaded=29
    server.process=SimpleNamespace(poll=lambda:None)
    server.require_gpu_residency()
    server.offloaded=28;server.failure_suffix="CUDA_RUNTIME_FAILED"
    server.process=SimpleNamespace(poll=lambda:1)
    with pytest.raises(ModelUnavailableError,match="CUDA_RUNTIME_FAILED"):
        server.require_gpu_residency()


def test_modified_tokenizer_never_reaches_generation(tmp_path,monkeypatch):
    config,artifact,_,_=artifact_fixture(tmp_path,monkeypatch)
    root=artifact.parents[2]
    (root/"buddy/adapter/tokenizer.json").write_bytes(b"corrupted tokenizer")
    with pytest.raises(ValueError,match="TOKENIZER_INTEGRITY"):
        config.verify_cbt_gguf()


def test_source_inventory_cannot_be_rewritten_with_a_new_claimed_identity(tmp_path,monkeypatch):
    config,artifact,_,_=artifact_fixture(tmp_path,monkeypatch)
    source=json.loads((artifact/"source-identity.json").read_text())
    source["files"]=[]
    (artifact/"source-identity.json").write_text(json.dumps(source))
    with pytest.raises(ValueError,match="GGUF_IDENTITY"):
        config.verify_cbt_gguf()


def test_native_evidence_retains_only_allowed_residency_fields():
    import io
    server=Server.__new__(Server)
    server.offloaded=0;server.cuda_model_bytes=0;server.total_layers=29;server.failure_suffix=None
    server.process=SimpleNamespace(stdout=io.BytesIO(b"private text must not be retained\nload_tensors: offloaded 29/29 layers to GPU\nload_tensors: CUDA0 model buffer size = 4460.45 MiB\n"),poll=lambda:None)
    server._discard_logs()
    assert server.offloaded==29 and server.cuda_model_bytes>4_600_000_000
    server.require_gpu_residency(4_677_120_000)
    assert 'private text' not in str({key:value for key,value in vars(server).items() if key!='process'})


def test_missing_cuda_model_buffer_cannot_claim_complete_offload():
    server=Server.__new__(Server)
    server.offloaded=29;server.total_layers=29;server.cuda_model_bytes=1;server.failure_suffix=None
    server.process=SimpleNamespace(poll=lambda:1)
    with pytest.raises(ModelUnavailableError):
        server.require_gpu_residency(4_677_120_000)



def test_nested_server_loss_exits_disposable_worker():
    import subprocess,sys
    from pathlib import Path
    root=Path(__file__).resolve().parents[1]
    code="import sys;sys.path.insert(0,"+repr(str(root))+");from types import SimpleNamespace;from app.buddy.llama_backend import Server;s=Server.__new__(Server);s.closed=False;s.process=SimpleNamespace(poll=lambda:1);s._watch()"
    result=subprocess.run([sys.executable,"-I","-B","-c",code],capture_output=True,timeout=15,
        creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0))
    assert result.returncode==70


def test_native_server_job_has_requested_resource_limits():
    import os,sys,ctypes,mmap
    if os.name!="nt":pytest.skip("Windows job limits")
    from pathlib import Path
    sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts"))
    from windows_resource_limits import api,Extended,CPU
    from app.buddy.job import WindowsJob
    job=WindowsJob(memory_bytes=28_000_000_000,cpu_percent=60)
    try:
        library=api();memory=Extended();cpu=CPU()
        assert library.QueryInformationJobObject(job.handle,9,ctypes.byref(memory),ctypes.sizeof(memory),None)
        assert library.QueryInformationJobObject(job.handle,15,ctypes.byref(cpu),ctypes.sizeof(cpu),None)
        assert 0 <= 28_000_000_000-memory.job_memory < mmap.PAGESIZE
        assert memory.basic.flags & 0x200 and cpu.flags & 5 == 5 and cpu.rate==6000
    finally:job.close()


def test_equivalent_runtime_inventory_order_and_json_spacing_are_accepted(tmp_path,monkeypatch):
    config,_,runtime,_=artifact_fixture(tmp_path,monkeypatch)
    manifest=json.loads((runtime/"manifest.json").read_text())
    manifest["files"].reverse()
    (runtime/"manifest.json").write_text(json.dumps(manifest,indent=4))
    config.verify_cbt_gguf()
