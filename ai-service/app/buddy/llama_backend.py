"""Private resident llama.cpp execution, underneath the unchanged V3 delivery policy."""
from __future__ import annotations
import atexit
import http.client
import json
import math
import os
import re
import secrets
import socket
import subprocess
import threading
import time
from types import SimpleNamespace
from app.buddy.job import spawn_owned, terminate_owned
from app.buddy.config import verify_cbt_gguf
from app.core.exceptions import ModelUnavailableError

ENGINE_VERSION = "llama-cpp-b12110-q4km-v1"
MAX_LINE = 256 * 1024


def fail(suffix):
    return ModelUnavailableError("BUDDY_CBT_" + suffix)


def sampling_parameters(settings, context, seed):
    return {"temperature": settings["CREATIVE_TEMPERATURE"], "top_k": settings["CREATIVE_TOP_K"],
        "top_p": settings["CREATIVE_TOP_P"], "repeat_penalty": settings["CREATIVE_REPETITION_PENALTY"],
        "repeat_last_n": context, "min_p": 0.0, "typical_p": 1.0,
        "presence_penalty": 0.0, "frequency_penalty": 0.0, "dry_multiplier": 0.0,
        "samplers": ["penalties", "temperature", "top_k", "top_p"], "seed": seed & 0xffffffff}


def verify_sampling(expected, actual):
    for name, value in expected.items():
        received = actual.get(name)
        if isinstance(value, (int, float)):
            if type(received) not in (int, float) or not math.isclose(value, received, rel_tol=1e-6, abs_tol=1e-6):
                raise fail("SAMPLER_MISMATCH")
        elif received != value:
            raise fail("SAMPLER_MISMATCH")


class Server:
    def __init__(self, model, executable, *, context=4096, layers=29, adapters=None, cancelled=None):
        self.token = secrets.token_urlsafe(48)
        self.context = context
        self.offloaded = 0
        self.cuda_model_bytes = 0
        self.total_layers = layers
        self.process = None
        self.closed = False
        self.failure_suffix = None
        self.lock = threading.Lock()
        with socket.socket() as reservation:
            reservation.bind(("127.0.0.1", 0))
            self.port = reservation.getsockname()[1]
        env = {key: value for key, value in os.environ.items() if key.upper() in
            ("SYSTEMROOT", "WINDIR", "PATH", "TEMP", "TMP", "COMSPEC", "USERPROFILE", "USERNAME", "LOCALAPPDATA", "CUDA_VISIBLE_DEVICES")}
        env["LLAMA_API_KEY"] = self.token
        threads = max(1, min(8, int((os.cpu_count() or 1) * .6)))
        command = [str(executable), "--model", str(model), "--host", "127.0.0.1", "--port", str(self.port),
            "--ctx-size", str(context), "--parallel", "1", "--n-gpu-layers", "all", "--device", "CUDA0",
            "--log-verbosity", "4", "--log-colors", "off", "--fit", "off", "--override-tensor", "token_embd.weight=CUDA0", "--no-context-shift", "--threads", str(threads), "--threads-batch", str(threads),
            "--threads-http", "2", "--cache-ram", "0", "--no-webui", "--slots", "--no-cors-credentials",
            "--cors-origins", "http://127.0.0.1:" + str(self.port), "--alias", "buddy-mixed-epochs-2"]
        working_directory = {}
        if adapters:
            from pathlib import Path
            directory = Path(adapters[0]).resolve().parent
            if any(Path(value).resolve().parent != directory for value in adapters):
                raise fail('SHARED_ADAPTER_IDENTITY_FAILED')
            working_directory = {'cwd': str(directory)}
            command += ['--lora-scaled', ','.join(Path(value).name+':0' for value in adapters), '--lora-init-without-apply']
        try:
            self.process = spawn_owned(command, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                resource_limits={"memory_bytes": 28_000_000_000, "cpu_percent": 60}, **working_directory)
            threading.Thread(target=self._discard_logs, daemon=True).start()
            deadline = time.monotonic() + 480
            while time.monotonic() < deadline:
                if cancelled and cancelled.is_set():
                    from app.core.exceptions import TalkCancelledError
                    raise TalkCancelledError('Cancelled')
                if self.process.poll() is not None:
                    raise fail(self.failure_suffix or "LLAMA_LOAD_FAILED")
                try:
                    if self.json("GET", "/health", timeout=1).get("status") == "ok":
                        break
                except (OSError, ModelUnavailableError, http.client.HTTPException):
                    pass
                time.sleep(.1)
            else:
                raise fail("LOAD_TIMEOUT")
            atexit.register(self.close)
        except BaseException:
            self.close()
            raise

    def require_gpu_residency(self, expected_model_bytes=None):
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            complete_buffer = expected_model_bytes is None or self.cuda_model_bytes >= expected_model_bytes - 1024**2
            if self.offloaded == self.total_layers and complete_buffer:
                return
            if self.process.poll() is not None:
                raise fail(self.failure_suffix or "LLAMA_LOAD_FAILED")
            time.sleep(.02)
        raise fail("GPU_OFFLOAD_MISMATCH")

    def _watch(self):
        # This module runs only in the disposable CBT worker. Make nested-server
        # loss visible to its parent's existing readiness/recovery watcher.
        while not self.closed:
            if self.process.poll() is not None and not self.closed:
                os._exit(70)
            time.sleep(.5)

    def _discard_logs(self):
        # Retain only an allowlisted residency measurement, never raw logs/prompts/paths.
        try:
            while True:
                line = self.process.stdout.readline(8193)
                if not line:
                    return
                buffer = re.search(rb"CUDA0 model buffer size =\s*([0-9.]+) MiB", line)
                if buffer:
                    self.cuda_model_bytes = int(float(buffer[1]) * 1024**2)
                adapter_buffer = re.search(rb"CUDA0 LoRA buffer size =\s*([0-9.]+) MiB", line)
                if adapter_buffer:
                    self.lora_cuda_buffers = getattr(self,'lora_cuda_buffers',[]) + [int(float(adapter_buffer[1])*1024**2)]
                if re.search(rb"CPU LoRA buffer size",line):
                    self.lora_cpu_buffer = True
                lower = line.lower()
                if b"out of memory" in lower:
                    self.failure_suffix = "INSUFFICIENT_MEMORY"
                elif b"cuda error" in lower or b"no kernel image" in lower:
                    self.failure_suffix = "CUDA_RUNTIME_FAILED"
                match = re.search(rb"offloaded (\d+)/(\d+) layers to GPU", line)
                if match:
                    done, total = map(int, match.groups())
                    if total == self.total_layers:
                        self.offloaded = done
        except (OSError, ValueError):
            return

    def connection(self, method, path, payload=None, timeout=60):
        if self.closed or self.process.poll() is not None:
            raise fail("WORKER_UNAVAILABLE")
        if path == '/lora-adapters' and method != 'GET':
            raise fail('TRANSPORT_INVALID')
        if path not in ("/health", "/tokenize", "/completion", "/slots", "/props", "/v1/models", "/lora-adapters"):
            raise fail("TRANSPORT_INVALID")
        body = None if payload is None else json.dumps(payload, allow_nan=False).encode("utf-8")
        if body and len(body) > 2 * 1024**2:
            raise fail("REQUEST_LIMIT")
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=timeout)
        try:
            connection.request(method, path, body, {"Authorization": "Bearer " + self.token, "Content-Type": "application/json"})
            response = connection.getresponse()
            if response.status != 200:
                raise fail("LLAMA_HTTP_FAILED")
            return connection, response
        except BaseException:
            connection.close()
            raise

    def json(self, method, path, payload=None, timeout=60):
        connection, response = self.connection(method, path, payload, timeout)
        try:
            body = response.read(2 * 1024**2 + 1)
            if len(body) > 2 * 1024**2:
                raise fail("RESPONSE_LIMIT")
            return json.loads(body)
        finally:
            response.close()
            connection.close()

    def idle(self):
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            slots = self.json("GET", "/slots", timeout=1)
            if isinstance(slots, list) and len(slots) == 1 and not slots[0].get("is_processing"):
                return
            time.sleep(.02)
        raise fail("CANCEL_TIMEOUT")

    def stream(self, payload):
        connection, response = self.connection("POST", "/completion", payload, timeout=300)
        try:
            while True:
                line = response.readline(MAX_LINE + 1)
                if len(line) > MAX_LINE:
                    raise fail("RESPONSE_LIMIT")
                if not line:
                    return
                if line.startswith(b"data: "):
                    value = line[6:].strip()
                    if value == b"[DONE]":
                        return
                    event = json.loads(value)
                    if event.get("error"):
                        raise fail("GENERATION_FAILED")
                    yield event
        finally:
            response.close()
            connection.close()

    def close(self):
        with self.lock:
            if self.closed:
                return
            self.closed = True
            if self.process:
                terminate_owned(self.process)
                if self.process.stdout:
                    self.process.stdout.close()


class GenerateBridge:
    """Minimal generate contract; V3 still owns prompt/stopping/approval/formatting."""
    def __init__(self, server, torch):
        self.server, self.torch = server, torch

    def generate(self, *, input_ids, attention_mask=None, max_new_tokens, stopping_criteria,
                 temperature, top_p, top_k, repetition_penalty, eos_token_id, **kwargs):
        torch = self.torch
        if input_ids.shape[0] != 1 or (attention_mask is not None and not bool((attention_mask == 1).all())):
            raise fail("INPUT_MISMATCH")
        prompt = input_ids[0].tolist()
        if len(prompt) + max_new_tokens > self.server.context:
            raise fail("CONTEXT_MISMATCH")
        settings = {"CREATIVE_TEMPERATURE": temperature, "CREATIVE_TOP_K": top_k,
                    "CREATIVE_TOP_P": top_p, "CREATIVE_REPETITION_PENALTY": repetition_penalty}
        payload = {"prompt": prompt, "n_predict": max_new_tokens, "stream": True, "return_tokens": True,
                   "cache_prompt": False, "n_keep": -1,
                   **sampling_parameters(settings, self.server.context, int(torch.initial_seed()))}
        if hasattr(self.server,'adapter_scales'):
            payload['lora'] = self.server.adapter_scales()
        generated = []
        stream = self.server.stream(payload)
        finished = False
        failed = False
        try:
            for event in stream:
                if event.get("truncated"):
                    raise fail("CONTEXT_MISMATCH")
                tokens = event.get("tokens", [])
                # Final event may contain the cumulative sequence; partial events carry new IDs.
                if event.get("stop"):
                    finished = True
                    break
                if not isinstance(tokens, list) or any(type(token) is not int or token < 0 for token in tokens):
                    raise fail("TOKEN_PROTOCOL_MISMATCH")
                for token in tokens:
                    generated.append(token)
                    if len(generated) > max_new_tokens:
                        raise fail("TOKEN_LIMIT_MISMATCH")
                    sequence = torch.tensor([prompt + generated], device=input_ids.device, dtype=input_ids.dtype)
                    if token in eos_token_id or bool(stopping_criteria(sequence, None)):
                        finished = True
                        break
                if finished:
                    break
            if not finished:
                raise fail("STREAM_INCOMPLETE")
        except BaseException:
            failed = True
            raise
        finally:
            stream.close()
            # The parent kills a failed worker before admitting another GPU task.
            # Preserve the original fault instead of masking it with a drain error.
            if not failed:
                self.server.idle()
        return SimpleNamespace(sequences=torch.tensor([prompt + generated], device=input_ids.device, dtype=input_ids.dtype))


def make_engine(v3, base, adapter, *, shared=None):
    import torch
    from transformers import AutoTokenizer, StoppingCriteria, StoppingCriteriaList
    if not torch.cuda.is_available():
        raise fail("CUDA_UNAVAILABLE")
    if shared is None:
        model, executable, lock = verify_cbt_gguf()
    else:
        model, executable, lock = None, None, shared.identity
    from app.buddy.gpu_memory import require_headroom
    require_headroom(torch, additional_bytes=lock["model"]["bytes"] + 1024**3 if shared is None else 0)
    engine = v3.LocalCBT.__new__(v3.LocalCBT)
    engine.torch = torch
    engine.device = torch.device("cuda:0")
    engine.tokenizer = AutoTokenizer.from_pretrained(adapter, local_files_only=True, trust_remote_code=False)
    engine.template_state = v3.verify_template(engine.tokenizer)
    if engine.tokenizer.pad_token_id is None:
        engine.tokenizer.pad_token = engine.tokenizer.eos_token
    engine.eos = v3.stop_ids(engine.tokenizer)
    engine.StoppingCriteria, engine.StoppingCriteriaList = StoppingCriteria, StoppingCriteriaList
    server = shared if shared is not None else Server(model, executable, context=v3.policy()["runtime"]["seqLength"],
                    layers=json.loads((base / "config.json").read_text(encoding="utf-8"))["num_hidden_layers"] + 1)
    try:
        for content in ("Hello, Buddy.", "Kumusta? Let's take one step."):
            text = engine.tokenizer.apply_chat_template([{"role": "user", "content": content}], tokenize=False, add_generation_prompt=True)
            expected = engine.tokenizer.encode(text, add_special_tokens=False)
            actual = server.json("POST", "/tokenize", {"content": text, "add_special": False, "parse_special": True})["tokens"]
            if expected != actual:
                raise fail("TOKENIZER_MISMATCH")
        prompt, _ = engine._input([{"role": "user", "content": "Hello."}], v3.system_prompt("Hello."), 1)
        sampling = sampling_parameters(v3.policy()["generationPolicy"], server.context, 42)
        warm = server.json("POST", "/completion", {"prompt": prompt["input_ids"][0].tolist(), "n_predict": 0,
            "cache_prompt": False, **sampling})
        verify_sampling(sampling, warm.get("generation_settings", {}))
        metadata = server.json("GET", "/v1/models")["data"][0]["meta"]
        base_config = json.loads((base / "config.json").read_text(encoding="utf-8"))
        if metadata.get("n_ctx") != server.context or metadata.get("n_vocab") != base_config["vocab_size"]:
            raise fail("CONTEXT_MISMATCH")
        if warm.get("truncated"):
            raise fail("CONTEXT_MISMATCH")
        server.require_gpu_residency(metadata["size"])
        require_headroom(torch)
        threading.Thread(target=server._watch, daemon=True).start()
        engine.model = GenerateBridge(server, torch)
        engine.close = server.close
        engine.llama_server = server
        engine.gguf_identity = {"engine": 'shared-seallms-b12110-q4km-v1' if shared is not None else ENGINE_VERSION, "quantization": "Q4_K_M", "artifactSHA256": lock["model"]["sha256"],
            "llamaCommit": lock["llamaCommit"], "contextTokens": server.context}
        return engine
    except BaseException:
        server.close()
        raise
