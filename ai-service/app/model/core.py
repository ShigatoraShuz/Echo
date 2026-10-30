"""Single GPU owner. Model artifacts are immutable and loaded only from the manifest root."""

import gc
import hashlib
import json
import os
import threading
import time
from pathlib import Path

from app.core.exceptions import ModelUnavailableError

LABELS = ["Others", "Anxious", "Depressed", "Frustrated", "Suicidal"]
EMOTIONS = ["joy", "trust", "fear", "surprise", "sadness", "disgust", "anger", "anticipation"]


class CoreRuntime:
    def __init__(self, settings):
        self.root = Path(settings.models_root).resolve()
        self.lock = threading.RLock()
        self.slots = threading.BoundedSemaphore(settings.queue_limit)
        self.active = None
        self.instance = None
        self.loaded = False
        self.load_milliseconds = {}
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
        if voice_manifest.exists():
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
            for name in ("xlmr", "e4", "phq8", "cbt"):
                if name=='phq8' and self.screening_unavailable:continue
                try:self._load(name)
                except Exception:
                    if name!='phq8':raise
                    self.screening_unavailable='MODEL_LOAD_FAILED'
                    self.release()
        finally:
            self.release()
        self.loaded = True

    def require_ready(self):
        if not self.loaded:
            raise ModelUnavailableError("Core model runtime unavailable.")

    def release(self):
        self.instance = None
        self.active = None
        gc.collect()
        import torch

        torch.cuda.empty_cache()

    def _load(self, name):
        if self.active == name:
            return self.instance
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
            model = PeftModel.from_pretrained(model, adapter, local_files_only=True).eval()
            obj = (model, tokenizer)
        elif name == "speech":
            obj = None
        else:
            raise ValueError("Unknown model")
        self.instance = obj
        self.active = name
        self.load_milliseconds[name] = (time.perf_counter() - started) * 1000
        return obj

    def metrics(self):
        import torch

        return {
            "ready": self.loaded,
            "screeningReady": getattr(self,"screening_unavailable",None) is None,
            "activeModel": self.active,
            "residentModelCount": int(self.instance is not None or self.active=="speech"),
            "speechPeakAllocatedBytes": getattr(self,"speech_peak_allocated",None),
            "peakAllocatedBytes": torch.cuda.max_memory_allocated(),
            "loadMilliseconds": self.load_milliseconds.copy(),
        }

    def call(self, name, fn):
        self.require_ready()
        if not self.slots.acquire(blocking=False):
            raise ModelUnavailableError("Inference queue is full.")
        try:
            if not self.lock.acquire(timeout=30):
                raise ModelUnavailableError("Inference queue timed out.")
            try:
                try:
                    return fn(self._load(name))
                except Exception:
                    self.release()
                    raise
            finally:
                self.lock.release()
        finally:
            self.slots.release()

    def classify(self, text, language="unknown"):
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
                    result['model']={'providerName':'local-base-voice','modelVersion':hashlib.sha256(manifest).hexdigest(),'inferenceVersion':hashlib.sha256(source.read_bytes()).hexdigest(),'voice':'MOSS default, no reference'}
                    return result
                finally:
                    if process.poll() is None:process.kill()
                    process.wait()
                    self.active=None
        return self.call('speech',execute)

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
