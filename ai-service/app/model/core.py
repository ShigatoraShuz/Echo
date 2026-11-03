"""Single GPU owner. Model artifacts are immutable and loaded only from the manifest root."""

import gc
import hashlib
import json
import os
import threading
import time
from pathlib import Path

from app.core.exceptions import ModelUnavailableError, TalkCancelledError, TalkBusyError

LABELS = ["Others", "Anxious", "Depressed", "Frustrated", "Suicidal"]
EMOTIONS = ["joy", "trust", "fear", "surprise", "sadness", "disgust", "anger", "anticipation"]


class CoreRuntime:
    def __init__(self, settings, *, text_only=False):
        self.root = Path(settings.models_root).resolve()
        self.lock = threading.RLock()
        self.slots = threading.BoundedSemaphore(settings.queue_limit)
        self.active = None
        self.instance = None
        self.resident = {} if text_only else None
        self.loaded = False
        self.load_milliseconds = {}
        self.load_counts = {}
        self.model_name = "echo-core"
        self.model_version = "echo-core-v3"
        self.adapter_path = str(self.root / "cbt/adapter")
        self.device = "cuda"
        self.max_input_tokens = 4096
        os.environ.update(
            HF_HUB_OFFLINE="1",
            TRANSFORMERS_OFFLINE="1",
            HF_DATASETS_OFFLINE="1",
            HF_HUB_DISABLE_TELEMETRY="1",
            TOKENIZERS_PARALLELISM="false",
        )
        self.manifest = json.loads((self.root / "manifest.json").read_text(encoding="utf-8"))
        code_root = Path(__file__).resolve().parents[3]
        for item in self.manifest["inferenceCode"]:
            source = (code_root / item["path"].replace("\\", "/")).resolve()
            if not source.is_relative_to(code_root / "ai-service/app/vendor"):
                raise ModelUnavailableError("Invalid inference-code manifest path.")
            if hashlib.sha256(source.read_bytes()).hexdigest() != item["sha256"]:
                raise ModelUnavailableError("Inference code differs from its manifest.")
        self.screening_unavailable=None
        for item in self.manifest["files"]:
            try:
                p = (self.root / item["path"]).resolve()
                if (
                    not p.is_relative_to(self.root)
                    or not p.is_file()
                    or p.stat().st_size != item["bytes"]
                ):
                    raise ModelUnavailableError("Model manifest verification failed.")
                h = hashlib.sha256()
                with p.open("rb") as f:
                    for block in iter(lambda: f.read(8 * 1024 * 1024), b""):
                        h.update(block)
                if h.hexdigest() != item["sha256"]:
                    raise ModelUnavailableError("Model checksum mismatch.")
            except (OSError,ModelUnavailableError):
                if str(item['path']).replace('\\','/').startswith('phq8-seallms/'):
                    self.screening_unavailable='MODEL_INTEGRITY_FAILED'
                else:raise
        voice_manifest=self.root/'voice/manifest.json'
        if not text_only and voice_manifest.exists():
            for item in json.loads(voice_manifest.read_text()):
                target=(self.root/item['path']).resolve()
                if not target.is_relative_to(self.root/'voice') or target.stat().st_size!=item['size']:
                    raise ModelUnavailableError('Invalid speech manifest')
                digest=hashlib.sha256()
                with target.open('rb') as stream:
                    for block in iter(lambda:stream.read(8*1024*1024),b''):digest.update(block)
                if digest.hexdigest()!=item['sha256']:raise ModelUnavailableError('Speech checksum mismatch')
        import torch

        if not torch.cuda.is_available():
            raise ModelUnavailableError("CUDA is required for the configured core runtime.")
        torch.cuda.reset_peak_memory_stats()
        try:
            for name in (() if text_only else ("xlmr", "e4", "phq8", "cbt")):
                if name=='phq8' and self.screening_unavailable:continue
                try:self._load(name)
                except Exception:
                    if name!='phq8':raise
                    self.screening_unavailable='MODEL_LOAD_FAILED'
                    self.release()
        finally:
            self.release()
        self.loaded = True
        self._talk_context=threading.local()
        if not text_only:
            from app.model.talk import TalkRuntime
            self.talk=TalkRuntime(self)

    def require_ready(self):
        if not self.loaded:
            raise ModelUnavailableError("Core model runtime unavailable.")

    def release(self):
        if isinstance(getattr(self, "resident", None), dict):
            self.resident.clear()
        self.instance = None
        self.active = None
        gc.collect()
        import torch

        torch.cuda.empty_cache()

    def _activate(self, name, value):
        if name in ("cbt", "phq8") and isinstance(value, tuple):
            value[0].set_adapter(name, inference_mode=True)
            value[0].eval()
        self.instance, self.active = value, name
        return value

    def _record_load(self, name, started):
        self.load_milliseconds[name] = (time.perf_counter() - started) * 1000
        self.load_counts = getattr(self, "load_counts", {})
        self.load_counts[name] = self.load_counts.get(name, 0) + 1

    def _shared_adapter(self, name, resident):
        if name not in ("cbt", "phq8"):
            return None
        peer = resident.get("phq8" if name == "cbt" else "cbt")
        if not isinstance(peer, tuple):
            return None
        adapter = self.root / ("phq8-seallms/adapter" if name == "phq8" else "cbt/adapter")
        config = json.loads((adapter / "adapter_config.json").read_text())
        # Sharing is restricted to independent LoRA deltas on this exact base.
        # Bias/merged/extra trainable modules keep the original isolated loader.
        peer_adapter = self.root / ("cbt/adapter" if name == "phq8" else "phq8-seallms/adapter")
        peer_config = json.loads((peer_adapter / "adapter_config.json").read_text())
        for candidate in (config, peer_config):
            if (candidate.get("peft_type") != "LORA" or candidate.get("bias") != "none"
                    or candidate.get("modules_to_save") or candidate.get("layer_replication") or candidate.get("use_dora")):
                return None
        base_config = json.loads((self.root / "cbt/base/config.json").read_text())
        if config.get("auto_mapping") and config["auto_mapping"]["base_model_class"] != base_config["architectures"][0]:
            raise ModelUnavailableError("CBT base/adapter architecture mismatch.")
        import torch
        extra = (adapter / "adapter_model.safetensors").stat().st_size * 2 + 128 * 1024**2
        if torch.cuda.mem_get_info()[0] < extra + 2 * 1024**3:
            return None
        from transformers import AutoTokenizer
        started = time.perf_counter()
        tokenizer = AutoTokenizer.from_pretrained(adapter, local_files_only=True)
        if not tokenizer.chat_template:
            raise ModelUnavailableError("CBT chat template is missing.")
        model = peer[0]
        model.load_adapter(adapter, adapter_name=name, is_trainable=False, local_files_only=True)
        value = (model, tokenizer)
        resident[name] = value
        self._record_load(name, started)
        return self._activate(name, value)

    def _evict_resident(self, resident, name):
        value = resident[name]
        identity = id(value[0] if isinstance(value, tuple) else value)
        for alias, candidate in list(resident.items()):
            if id(candidate[0] if isinstance(candidate, tuple) else candidate) == identity:
                del resident[alias]

    def _load(self, name):
        if self.active == name:
            return self.instance
        resident = getattr(self, "resident", None)
        if isinstance(resident, dict) and name in ("xlmr", "e4", "cbt", "phq8"):
            if name in resident:
                return self._activate(name, resident[name])
            shared = self._shared_adapter(name, resident)
            if shared is not None:
                return shared
            self.instance, self.active = None, None
            # Retain fixed text models and the shared LLM only while the budget fits.
            # No inputs or predictions are cached. Generation settings stay unchanged.
            gc.collect()
            import torch

            torch.cuda.empty_cache()
            # Measured installed-model peaks rounded up, plus 2 GiB free headroom.
            required = {"xlmr": 2, "e4": 2, "cbt": 7, "phq8": 7}[name] * 1024**3
            for previous in list(resident):
                if previous not in resident:
                    continue
                if torch.cuda.mem_get_info()[0] >= required + 2 * 1024**3:
                    break
                # Evict only under pressure; prefer retaining the safety classifier.
                if previous != "xlmr":
                    self._evict_resident(resident, previous)
                    gc.collect()
                    torch.cuda.empty_cache()
            if torch.cuda.mem_get_info()[0] < required + 2 * 1024**3:
                self.release()
        else:
            self.release()
        started = time.perf_counter()
        if name == "xlmr":
            from app.vendor.xlmr.classifier import Classifier

            obj = Classifier(str(self.root / "xlmr-v2"), stride=64)
        elif name == "e4":
            from app.vendor.e4.model import load_model

            obj = load_model(self.root / "e4-c", device="cuda")
        elif name in ("cbt", "phq8"):
            import torch
            from peft import PeftModel
            from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

            base = self.root / "cbt/base"
            adapter = self.root / ("phq8-seallms/adapter" if name == "phq8" else "cbt/adapter")
            config = json.loads((adapter / "adapter_config.json").read_text())
            base_config = json.loads((base / "config.json").read_text())
            if config.get("auto_mapping") and config["auto_mapping"]["base_model_class"] != base_config["architectures"][0]:
                raise ModelUnavailableError("CBT base/adapter architecture mismatch.")
            tokenizer = AutoTokenizer.from_pretrained(adapter, local_files_only=True)
            if not tokenizer.chat_template:
                raise ModelUnavailableError("CBT chat template is missing.")
            model = AutoModelForCausalLM.from_pretrained(
                base,
                local_files_only=True,
                trust_remote_code=False,
                device_map={"": 0},
                quantization_config=BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_quant_type="nf4",
                    bnb_4bit_compute_dtype=torch.bfloat16,
                ),
            )
            model = PeftModel.from_pretrained(model, adapter, local_files_only=True,
                **({"adapter_name": name} if isinstance(resident, dict) else {})).eval()
            obj = (model, tokenizer)
        elif name in ("speech", "face"):
            obj = None
        else:
            raise ValueError("Unknown model")
        self.instance = obj
        self.active = name
        if isinstance(resident, dict):
            resident[name] = obj
        self._record_load(name, started)
        return obj

    def metrics(self):
        import torch

        return {
            "ready": self.loaded,
            "talkActive": bool(getattr(self,"talk",None) and self.talk.owner),
            "screeningReady": getattr(self,"screening_unavailable",None) is None,
            "activeModel": self.active,
            "residentModelCount": (len({id(v[0] if isinstance(v, tuple) else v) for v in self.resident.values()}) if isinstance(getattr(self, "resident", None), dict)
                                   else int(self.instance is not None or self.active == "speech"))
                                  + int(bool(getattr(self,"talk",None) and self.talk.owner and self.talk.device=="cuda" and self.talk.process is not None)),
            "freeGpuBytes": torch.cuda.mem_get_info()[0],
            "speechPeakAllocatedBytes": getattr(self,"speech_peak_allocated",None),
            "peakAllocatedBytes": torch.cuda.max_memory_allocated(),
            "loadMilliseconds": self.load_milliseconds.copy(),
            "modelLoadCounts": getattr(self, "load_counts", {}).copy(),
            "residentModels": sorted(self.resident) if isinstance(getattr(self, "resident", None), dict) else [],
        }

    def call(self, name, fn):
        self.require_ready()
        if getattr(self,"talk",None) and self.talk.owner and not getattr(self._talk_context,"active",False):raise TalkBusyError("Talk has priority between stages")
        if not self.slots.acquire(blocking=False):
            raise ModelUnavailableError("Inference queue is full.")
        try:
            if not self.lock.acquire(timeout=30):
                raise ModelUnavailableError("Inference queue timed out.")
            try:
                if getattr(self,"talk",None) and self.talk.owner and not getattr(self._talk_context,"active",False):raise TalkBusyError("Talk has priority between stages")
                try:
                    return fn(self._load(name))
                except Exception as error:
                    if not isinstance(error,TalkCancelledError):self.release()
                    raise
            finally:
                self.lock.release()
        finally:
            self.slots.release()

    def classify(self, text, language="unknown"):
        if getattr(getattr(self,"_talk_context",None),"active",False):return self._talk_classifier.classify(text,language=language)
        if not isinstance(text, str) or not text.strip() or len(text) > 20000:
            raise ValueError("Invalid journal text.")
        return self.call("xlmr", lambda m: m.classify(text, language=language))

    def provenance(self, name):
        prefix = {"xlmr": "xlmr-v2/", "e4": "e4-c/", "cbt": "cbt/"}[name]
        files = [
            (v["path"], v["sha256"]) for v in self.manifest["files"] if v["path"].startswith(prefix)
        ]
        code = [
            {"path": v["path"].replace("\\", "/"), "sha256": v["sha256"]}
            for v in self.manifest["inferenceCode"]
            if f"/vendor/{name}/" in v["path"].replace("\\", "/")
        ]
        if not code:
            raise ModelUnavailableError("Missing inference-code provenance.")
        return {
            "providerName": name,
            "modelVersion": hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest(),
            "inferenceVersion": hashlib.sha256(
                json.dumps(code, sort_keys=True).encode()
            ).hexdigest(),
        }

    def analyze(self, text, language="unknown", classification=None):
        classification = classification or self.classify(text, language)
        from app.vendor.e4.inference import infer_journal

        emotion = self.call("e4", lambda m: infer_journal(m[0], m[1], m[3], text))
        category = classification["distress_category"]
        features = {
            "Anxious": "paced_breathing",
            "Depressed": "behavioral_activation",
            "Frustrated": "grounding",
            "Suicidal": "support_connection",
            "Others": "grounding",
        }
        try:
            screening=self.screening(text)
        except TalkBusyError:
            raise
        except Exception:
            screening={'status':'unavailable' if getattr(self,'screening_unavailable',None) else 'failed','experimental':True,'inferenceVersion':'journal-nullable-v1','items':None,'coverage':0,'subtotal':None,'total':None}
        return {
            "schemaVersion": "echo-journal-analysis-v3",
            "journalScreening":screening,
            "thresholdVersion": "xlmr-v2-frozen",
            "providerName": "echo-core",
            "modelVersion": "echo-core-v3",
            "isSimulated": False,
            "emotionDistribution": [
                {"emotion": k, "value": v} for k, v in emotion["plutchik_8"].items()
            ],
            "dominantEmotion": emotion["dominant_plutchik"],
            "emotionConfidence": max(emotion["plutchik_8"].values()),
            "distressBand": None,
            "distressConfidence": None,
            "depressiveSymptomRange": None,
            "recommendationFeatures": [features[category]],
            "facialExpressionAnalysis": None,
            "categoryScores": classification["all_category_scores_relative_not_diagnoses"],
            "distressCategory": category,
            "goEmotions": emotion["goemotions_27"],
            "supportReviewRequired": classification["suicidal_language_flag"],
            "classificationMetadata": {
                "maxLength": 384,
                "stride": 64,
                "threshold": classification["validation_selected_suicidal_flag_threshold"],
                "windowCount": classification["number_of_windows"],
                "declaredLanguage": language,
            },
            "models": {"xlmr": self.provenance("xlmr"), "e4": self.provenance("e4")},
        }

    def chat(self, messages):
        text = messages[-1]["content"]
        classification = self.classify(text)
        if classification["suicidal_language_flag"]:
            return {"reply": None, "supportRequired": True, "model": self.provenance("xlmr")}
        from app.vendor.cbt.echo_v41 import (
            FILIPINO_STYLE_GUIDE,
            TAGLISH_STYLE_GUIDE,
            V41_SYSTEM,
            detect_language,
            infer_v41,
        )

        def generate(model):
            language = detect_language(messages)
            guide = (
                FILIPINO_STYLE_GUIDE
                if language == "filipino"
                else TAGLISH_STYLE_GUIDE
                if language == "taglish"
                else ""
            )
            prompt = [{"role": "system", "content": V41_SYSTEM + guide}, messages[-1]]
            tokens = model[1].apply_chat_template(prompt, tokenize=True, add_generation_prompt=True)
            if len(tokens) > 4096 - 900:
                raise ValueError("The latest message exceeds the generation context budget.")
            return infer_v41(model[0], model[1], messages, seq_length=4096, max_new_tokens=900)

        reply, audit = self.call("cbt", generate)
        if audit["needs_review"] or audit.get("fallback_used"):
            raise ModelUnavailableError("The generated response requires review.")
        return {
            "reply": reply,
            "supportRequired": False,
            "model": self.provenance("cbt"),
            "quality": {
                "rewriteAttempted": audit["rewrite_attempted"],
                "inferenceVersion": audit["version"],
            },
        }

    def speech(self, payload, cancelled=None):
        import subprocess,tempfile
        def execute(_):
            python=Path(os.environ.get('SPEECH_PYTHON',str(self.root.parent/'speech-venv/Scripts/python.exe')))
            with tempfile.TemporaryDirectory(dir=self.root.parent/'runtime-cache') as folder:
                request=Path(folder)/'request.json';output=Path(folder)/'result.json'
                request.write_text(json.dumps(payload))
                process=subprocess.Popen([str(python),'-B',str(Path(__file__).parents[1]/'speech_worker.py'),str(self.root/'voice'),str(request),str(output)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
                deadline=time.monotonic()+300
                try:
                    while process.poll() is None:
                        if time.monotonic()>deadline or (cancelled and cancelled.is_set()):raise ModelUnavailableError('Speech cancelled or timed out')
                        time.sleep(0.1)
                    if process.returncode:raise ModelUnavailableError('Speech pipeline failed')
                    result=json.loads(output.read_text())
                    if 'peakBytes' in result:self.speech_peak_allocated=result['peakBytes']
                    manifest=(self.root/'voice/manifest.json').read_bytes()
                    source=Path(__file__).parents[1]/'speech_worker.py'
                    result['model']={'providerName':'local-faster-whisper' if payload['task']=='transcribe' else 'local-moss-tts','modelVersion':hashlib.sha256(manifest).hexdigest(),'inferenceVersion':hashlib.sha256(source.read_bytes()).hexdigest()}
                    if payload['task']=='speak':result['model']['voice']='MOSS default, no reference'
                    return result
                finally:
                    if process.poll() is None:process.kill()
                    process.wait()
                    self.active=None
        return self.call('speech',execute)

    def face(self, encoded):
        import base64, subprocess, tempfile
        data = base64.b64decode(encoded, validate=True)
        if not data or len(data) > 2 * 1024 * 1024:
            raise ValueError('Image exceeds 2 MiB')
        def execute(_):
            python = Path(os.environ.get('FACE_PYTHON', str(self.root.parent/'face-venv/Scripts/python.exe')))
            with tempfile.TemporaryDirectory(dir=self.root.parent/'runtime-cache') as folder:
                image = Path(folder)/'capture.image'
                output = Path(folder)/'result.json'
                image.write_bytes(data)
                subprocess.run([str(python), '-B', str(Path(__file__).parents[1]/'face_worker.py'), str(self.root/'face_model'), str(image), str(output)], check=True, timeout=90, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
                return json.loads(output.read_text())
        return self.call('face', execute)

    def screening(self,text):
        if getattr(self,'screening_unavailable',None):raise ModelUnavailableError('Screening model unavailable')
        if not isinstance(text,str) or not text.strip() or len(text)>20000:raise ValueError('Invalid journal text')
        from app.model.screening import infer
        result=self.call('phq8',lambda m:infer(m[0],m[1],text))
        result.update(self.screening_provenance())
        return result

    def screening_provenance(self):
        from app.model.screening import VERSION
        files=[(v['path'],v['sha256']) for v in self.manifest['files'] if v['path'].startswith(('phq8-seallms/','cbt/base/'))]
        code=Path(__file__).with_name('screening.py').read_bytes()
        return {'modelFingerprint':hashlib.sha256(json.dumps(files,sort_keys=True).encode()).hexdigest(),'inferenceVersion':VERSION+':'+hashlib.sha256(code).hexdigest()[:16]}
