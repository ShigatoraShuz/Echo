"""Private resident workers. Inputs, drafts and output audio are memory-only."""
import base64
import contextlib
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from app.buddy.config import HERE, ADAPTER_SHA, VOICE_SHA, digest, paths, verify_adapter, verify_nano
from app.buddy.text_audio import validate, assemble
KIND = sys.argv[1] if __name__ == "__main__" else ""
ENGINE = None
MODEL_IDENTITY = None

def cbt(request):
    global ENGINE, MODEL_IDENTITY
    if ENGINE is None:
        sys.path.insert(0, str(HERE / "v3"))
        import echo_cbt_standalone as v3
        import torch
        if not torch.cuda.is_available():
            raise RuntimeError("BUDDY_CUDA_UNAVAILABLE")
        base, adapter = verify_adapter()
        original = v3.policy
        def policy():
            value = original()
            value["manifestEntries"] = [x for x in value["manifestEntries"]
                if not x["path"].replace("\\", "/").startswith("cbt/adapter/") and ".cache" not in Path(x["path"].replace("\\", "/")).parts]
            return value
        v3.policy = policy
        v3.preflight(base, adapter, check_hashes=True)
        # Preserve every available base inventory check, including weight shards.
        for entry in policy()["manifestEntries"]:
            name = entry["path"].replace("\\", "/")
            if name.startswith("cbt/base/"):
                file = base / name[len("cbt/base/"):]
                if file.stat().st_size != entry["bytes"] or digest(file) != entry["sha256"]:
                    raise ValueError("CBT base integrity failed")
        from app.buddy.config import verify_policy
        from app.buddy.llama_backend import make_engine
        verify_policy()
        ENGINE = make_engine(v3, base, adapter)
        MODEL_IDENTITY = {"providerName": "buddy-mixed-epochs-2", "modelVersion": ADAPTER_SHA,
                          "inferenceVersion": v3.VERSION, "base": "SeaLLMs-v3-7B-Chat",
                          "template": ENGINE.template_state, "formatterVersion": digest(HERE / "formatter-source.lock.json"),
                          **ENGINE.gguf_identity}
    if request.get("check"):
        return MODEL_IDENTITY
    from app.buddy.gpu_memory import require_headroom
    import torch
    require_headroom(torch)
    started = time.perf_counter()
    result = ENGINE.reply(request["messages"])
    require_headroom(torch)
    # Do not deliver raw drafts, rejected attempts, prompts, or local paths.
    if result.get("needs_review") or not result.get("reply"):
        return {"reply": None, "withheld": True, "issues": result.get("issues", []),
                "model": MODEL_IDENTITY, "seconds": time.perf_counter() - started}
    quality = {key: result[key] for key in ("attempts", "rewrite_attempted", "dropped_history_turns",
               "auto_format_preserved_content", "inference_version") if key in result}
    return {"reply": result["reply"], "withheld": False, "model": MODEL_IDENTITY,
            "quality": quality, "seconds": time.perf_counter() - started}

def nano(request):
    global ENGINE, MODEL_IDENTITY
    import torch
    import numpy as np
    import soundfile as sf
    import transformers
    if ENGINE is None:
        if not torch.cuda.is_available():
            raise RuntimeError("BUDDY_CUDA_UNAVAILABLE")
        if not torch.__version__.startswith("2.11.0") or torch.version.cuda != "13.0" or transformers.__version__ != "4.57.1":
            raise RuntimeError("BUDDY_NANO_RUNTIME_MISMATCH")
        root = verify_nano()
        sys.path.insert(0, str(HERE / "nano_vendor"))
        from moss_tts_nano_runtime import NanoTTSService, VoicePreset
        from app.buddy.wav_io import install_wav_io
        service = NanoTTSService(checkpoint_path=root / "models/nano",
            audio_tokenizer_path=root / "models/codec", device="cuda", dtype="bfloat16",
            attn_implementation="sdpa", voice_presets={"Buddy": VoicePreset("Buddy",
            root / "voices/buddy/sample.wav", "Saved generated Buddy voice")},
            output_dir=root / "cache")  # No synthesize-to-file API is used.
        model = service.get_model()
        install_wav_io(model)
        codec = service._load_audio_tokenizer_locked(tts_attn_implementation="sdpa")
        wave, rate = sf.read(root / "voices/buddy/sample.wav", dtype="float32", always_2d=True)
        validate(wave, rate)
        if rate != 48000 or wave.shape[1] != 2:
            raise ValueError("Voice reference format")
        nq = model._resolve_inference_nq()
        with torch.inference_mode():
            codes = model._call_audio_encode(audio_tokenizer=codec,
                waveform=torch.from_numpy(wave.T.copy()).to(service.device), sample_rate=rate)
            codes = model._mask_unused_audio_channels(model._normalize_audio_codes(codes), nq=nq).to(service.device)
        tokenizer = model._load_text_tokenizer(text_tokenizer_path=str(root / "models/nano"))
        ENGINE = (service, model, codec, codes, tokenizer, nq)
        MODEL_IDENTITY = {"providerName": "MOSS-TTS-Nano", "modelVersion": digest(HERE / "assets.lock.json"),
            "inferenceVersion": "echo-buddy-nano-v2", "voiceReferenceSHA256": VOICE_SHA,
            "generation": {"seed": 42, "maxNewFrames": 4096, "audioTemperature": .8,
                           "audioTopP": .95, "audioTopK": 25, "audioRepetitionPenalty": 1.2},
            "runtime": {"torch": torch.__version__, "transformers": transformers.__version__,
                        "soundfile": sf.__version__},
            "sampleRate": 48000, "channels": 2}
    from app.buddy.gpu_memory import require_headroom
    if request.get("check"):
        return {"model": MODEL_IDENTITY, "freeGpuBytes": require_headroom(torch)["freeBytes"]}
    started = time.perf_counter()
    texts = request["texts"]
    if not 1 <= len(texts) <= 3 or any(not isinstance(t, str) or not t.strip() for t in texts):
        raise ValueError("Invalid sentence batch")
    service, model, codec, prompt, tokenizer, nq = ENGINE
    if any(len(tokenizer.encode(t, add_special_tokens=False)) > 512 for t in texts):
        raise ValueError("Sentence exceeds Nano token budget")
    from app.buddy.nano_batch import generate
    waves = generate(service, model, codec, prompt, tokenizer, nq, texts)
    segments = []
    for text, wave in zip(texts, waves):
        wave = validate(wave, 48000)
        if wave.shape[1] != 2 or len(wave) > 45 * 48000:
            raise ValueError("Invalid output format or duration")
        _, processed = assemble([wave], 48000)
        audio = (np.clip(processed, -1, 1) * 32767).astype("<i2").tobytes()
        segments.append({"text": text, "audio": base64.b64encode(audio).decode(),
                         "sampleRate": 48000, "channels": 2})
    return {"segments": segments, "model": MODEL_IDENTITY,
            "seconds": time.perf_counter() - started, "freeGpuBytes": require_headroom(torch)["freeBytes"]}

def whisper(request):
    global ENGINE, MODEL_IDENTITY
    import numpy as np
    if ENGINE is None:
        from faster_whisper import WhisperModel
        root = paths()["whisper_model"]
        ENGINE = WhisperModel(str(root), device="cpu", compute_type="int8", local_files_only=True, cpu_threads=4)
        MODEL_IDENTITY = {"providerName": "local-faster-whisper", "whisperDevice": "cpu", "computeType": "int8"}
    if request.get("check"):
        return {"model": MODEL_IDENTITY}
    raw = base64.b64decode(request["audio"], validate=True)
    if request.get('audioFormat')=='encoded':
        import av,io
        pieces=[];count=0
        with av.open(io.BytesIO(raw),options={'protocol_whitelist':'pipe'}) as container:
            if container.streams.video or not container.streams.audio:raise ValueError('Audio only required')
            converter=av.AudioResampler(format='s16',layout='mono',rate=16000)
            for frame in container.decode(audio=0):
                for part in converter.resample(frame):
                    values=part.to_ndarray().reshape(-1);count+=len(values)
                    if count>60*16000:raise ValueError('Audio duration limit')
                    pieces.append(values.astype(np.float32)/32768)
        samples=np.concatenate(pieces) if pieces else np.zeros(0,dtype=np.float32)
    else:
        if not raw or len(raw)%2 or len(raw)>60*16000*2:raise ValueError('Invalid microphone PCM')
        samples=np.frombuffer(raw,dtype='<i2').astype(np.float32)/32768
    if len(samples) < 7200 or float(np.abs(samples).max()) < .005:
        return {"text": "", "model": MODEL_IDENTITY}
    language = {"English": "en", "Filipino": "tl", "Taglish": None}[request.get("language", "English")]
    started = time.perf_counter()
    segments, info = ENGINE.transcribe(samples, language=language, beam_size=1,
        condition_on_previous_text=False, vad_filter=True)
    text = " ".join(s.text.strip() for s in segments if s.no_speech_prob < .6).strip()
    if len(text) > 4000:
        raise ValueError("Transcript exceeds limit")
    return {"text": text, "language": info.language, "model": MODEL_IDENTITY,
            "seconds": time.perf_counter() - started}

def residency():
    result = {"pid": os.getpid(), "kind": KIND, "loaded": ENGINE is not None}
    if ENGINE is None:
        return result
    if KIND == "whisper":
        result["device"] = str(ENGINE.model.device)
        result["computeType"] = str(ENGINE.model.compute_type)
        return result
    import torch
    if KIND == "cbt" and hasattr(ENGINE, "llama_server"):
        from app.buddy.gpu_memory import global_memory
        memory = global_memory(torch)
        server = ENGINE.llama_server
        result.update(engine=ENGINE.gguf_identity["engine"], serverPid=server.process.pid,
            parameterDevices={"cbt": ["cuda:0"]}, offloadedLayers=server.offloaded,
            totalLayers=server.total_layers, modelGpuBufferBytes=server.cuda_model_bytes,
            deviceEvidence="llama.cpp full-layer offload and complete CUDA model buffer",
            globalFreeBytes=memory["freeBytes"], globalTotalBytes=memory["totalBytes"], memorySource=memory["source"])
        return result
    models = {"cbt": ENGINE.model} if KIND == "cbt" else {"nano": ENGINE[1], "codec": ENGINE[2]}
    result["parameterDevices"] = {
        name: sorted({str(parameter.device) for parameter in model.parameters()})
        for name, model in models.items()
    }
    if KIND == "nano":
        result["referenceDevice"] = str(ENGINE[3].device)
    result.update(allocatedBytes=torch.cuda.memory_allocated(),
                  reservedBytes=torch.cuda.memory_reserved(),
                  peakAllocatedBytes=torch.cuda.max_memory_allocated(),
                  peakReservedBytes=torch.cuda.max_memory_reserved(),
                  processReportedFreeBytes=torch.cuda.mem_get_info()[0])
    return result

def loading_error_code(error, kind, checking=False):
    """No exception message/path is returned unless it is already a safe code."""
    code = str(error)
    if code.startswith("BUDDY_") and code.replace("_", "").isalnum() and len(code) < 80:
        return code
    suffix = "PREFLIGHT_OR_INFERENCE_FAILED"
    if type(error).__name__ == "OutOfMemoryError":
        suffix = "INSUFFICIENT_MEMORY"
    elif isinstance(error, FileNotFoundError):
        suffix = "ASSET_MISSING"
    elif isinstance(error, (ImportError, ModuleNotFoundError)):
        suffix = "ENV_IMPORT_FAILED"
    elif isinstance(error, PermissionError) or "Access is denied" in code:
        suffix = "ENV_ACCESS_DENIED"
    elif checking and isinstance(error, ValueError):
        suffix = "ASSET_INVALID"
    return "BUDDY_" + kind.upper() + "_" + suffix


def main():
    # Windows job ownership already releases this worker on parent death.
    # Keep initial native imports on the input thread, as in the Nano tester:
    # a blocked reader thread can stall native NumPy/DLL initialization.
    while True:
        line = sys.stdin.buffer.readline(3 * 1024 * 1024 + 1)
        if not line:
            return
        if len(line) > 3 * 1024 * 1024 or not line.endswith(b"\n"):
            return
        packet = json.loads(line)
        try:
            with contextlib.redirect_stdout(sys.stderr):
                result = residency() if packet["request"].get("stats") else {"cbt": cbt, "nano": nano, "whisper": whisper}[KIND](packet["request"])
            reply = {"id": packet["id"], "result": result}
        except Exception as error:
            reply = {"id": packet["id"], "error": loading_error_code(error, KIND, packet["request"].get("check") is True)}
        data = json.dumps(reply, allow_nan=False).encode() + b"\n"
        if len(data) > 40 * 1024 * 1024:
            data = json.dumps({"id": packet["id"], "error": "BUDDY_AUDIO_LIMIT"}).encode() + b"\n"
        sys.__stdout__.buffer.write(data)
        sys.__stdout__.buffer.flush()

if __name__ == "__main__":
    main()

