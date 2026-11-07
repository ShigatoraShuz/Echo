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
    def __init__(self, settings, *, text_only=False, component=None):
        if component not in (None,'xlmr','e4','phq8'):
            raise ValueError('Invalid native component')
        self.root = Path(settings.models_root).resolve()
        self.lock = threading.RLock()
        self.slots = threading.BoundedSemaphore(settings.queue_limit)
        self.active = None
        self.instance = None
        self.resident = {} if text_only else None
        self.isolated_native = text_only
        self.operation_cancelled = None
        self.native_progress = None
        from app.buddy.shared_seallms import selected,SharedRuntime
        self.shared_enabled = False  # Shared llama.cpp candidate remains unselected.
        self.shared_runtime = None
        from app.buddy.hf_shared import SharedHF
        self.hf_enabled = component is None and text_only
        self.hf_runtime = SharedHF() if self.hf_enabled else None
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
        from app.buddy.config import verify_policy
        verify_policy()
        for item in self.manifest["inferenceCode"]:
            source = (code_root / item["path"].replace("\\", "/")).resolve()
            if not source.is_relative_to(code_root / "ai-service/app/vendor"):
                raise ModelUnavailableError("Invalid inference-code manifest path.")
            if source.is_relative_to(code_root / "ai-service/app/vendor/cbt"):
                # Buddy now runs the hash-verified V3 policy above in its exact
                # two-epoch worker. The installed legacy/v5 code is never run.
                # Shared base/adapter artifact checks below remain unchanged.
                continue
            if hashlib.sha256(source.read_bytes()).hexdigest() != item["sha256"]:
                raise ModelUnavailableError("Inference code differs from its manifest.")
        self.screening_unavailable=None
        prefixes={'xlmr':('xlmr-v2/',),'e4':('e4-c/',),'phq8':('phq8-seallms/','cbt/base/')}.get(component)
        if prefixes and not any(str(item['path']).replace('\\','/').startswith(prefixes) for item in self.manifest['files']):
            raise ModelUnavailableError('Missing native component inventory')
        for item in self.manifest["files"]:
            if prefixes and not str(item['path']).replace('\\','/').startswith(prefixes):
                continue
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
        from app.buddy.config import enabled
        from app.buddy.runtime import BuddyRuntime
        self.buddy = BuddyRuntime(self)
        if enabled():
            self.talk = self.buddy
        elif not text_only:
            from app.model.talk import TalkRuntime
            self.talk=TalkRuntime(self)

    def preload(self):
        if not self.hf_enabled:
            raise ModelUnavailableError('BUDDY_CBT_SHARED_PROFILE_REQUIRED')
        with self.lock:
            self.hf_runtime.keep_loaded = True
            self.buddy._prepare('cbt', self.operation_cancelled)
            return {'baseReady': True, 'startupResident': True}

    def require_journal_owner(self, owner):
        if owner and owner not in getattr(self, "journal_owners", set()):
            raise TalkBusyError("Journal page is inactive")

    def _close_native_values(self, values):
        from app.model.native_process import NativeProcess
        for value in list(values):
            if isinstance(value, NativeProcess) or hasattr(value, 'phq_pass'):
                value.close()

    def journal_runtime(self, action, owners):
        with self.lock:
            self.journal_owners = set(owners)
            self.journal_paused = not bool(owners)
            if action == "owners": return {"ownersUpdated": True}
            if action == "prepare":
                self.journal_paused = False
                self.classify("Today was a quiet day.")
                return {"ready": True}
            if action != "unload": raise ValueError("Invalid journal action")
            self.journal_owners = set()
            self.journal_paused = True
            if isinstance(self.resident, dict):
                self._close_native_values(self.resident.values())
                self.resident.clear()
            self.instance = None
            self.active = None
            gc.collect()
            import torch
            torch.cuda.empty_cache()
            if getattr(self,'shared_runtime',None):self.shared_runtime.maybe_release()
            return {"unloaded": True}

    def require_ready(self):
        if not self.loaded:
            raise ModelUnavailableError("Core model runtime unavailable.")

    def release(self):
        if getattr(self, "buddy", None):
            self.buddy.evict()
        if isinstance(getattr(self, "resident", None), dict):
            self._close_native_values(self.resident.values())
            self.resident.clear()
        self.instance = None
        self.active = None
        gc.collect()
        import torch

        torch.cuda.empty_cache()
        if getattr(self,'shared_runtime',None):self.shared_runtime.maybe_release()

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
                self._close_native_values([candidate])
                del resident[alias]
        if getattr(self,'instance',None) is value:
            self.instance, self.active = None, None

    def ensure_buddy_capacity(self, additional_bytes=4*1024**3):
        from app.buddy.gpu_memory import global_memory
        import torch
        # Measured 4096-token prefill/generation reserve, independent of live weights.
        target = additional_bytes + 2*1024**3
        for name in ('e4','xlmr'):
            if global_memory(torch)['freeBytes'] >= target:
                return
            if name in self.resident:
                self._evict_resident(self.resident,name)
        if global_memory(torch)['freeBytes'] < target:
            raise TalkBusyError('GPU capacity waiting')

    def _load_native_once(self, name):
        from app.model.native_process import NativeProcess
        from app.buddy.gpu_memory import global_memory
        import torch
        buddy = getattr(self, 'buddy', None)
        cbt = getattr(buddy, 'workers', {}).get('cbt') if buddy else None
        if cbt and cbt.process.poll() is None and not getattr(self,'hf_enabled',False):
            raise TalkBusyError('Buddy residency has priority')
        if name == 'phq8' and getattr(self, 'hf_enabled', False):
            value = self.hf_runtime.acquire('phq8',getattr(self,'operation_cancelled',None))
            self.resident[name] = value
            value.call({'check':True},getattr(self,'operation_cancelled',None))
            return self._activate(name,value)
        shared=self.shared_runtime.capability(getattr(self,'operation_cancelled',None)) if name=='phq8' and getattr(self,'shared_enabled',False) else None
        value = self.resident.get(name)
        if isinstance(value, NativeProcess):
            if value.ready and value.process.poll() is None:
                return self._activate(name, value)
            value.close(); self.resident.pop(name, None)
        required = (0 if shared is not None else {'xlmr':2,'e4':2,'phq8':7}[name])*1024**3
        if global_memory(torch)['freeBytes'] < required+2*1024**3:
            for previous in list(self.resident):
                if previous != 'xlmr':
                    self._evict_resident(self.resident, previous)
                if global_memory(torch)['freeBytes'] >= required+2*1024**3:
                    break
        if global_memory(torch)['freeBytes'] < required+2*1024**3:
            raise TalkBusyError('GPU capacity waiting')
        started = time.perf_counter()
        value = NativeProcess(self.root, name, getattr(self,'operation_cancelled',None),inference_seconds=getattr(self,'native_inference_seconds',270),**({'shared':shared} if shared is not None else {}))
        self.resident[name] = value
        self._record_load(name, started)
        return self._activate(name, value)

    def _load(self, name):
        from app.model.loading_policy import load_with_retries
        resident=getattr(self,'resident',None)
        def cleanup():
            # Keep successfully resident components; discard only this failed load.
            if isinstance(resident,dict):
                value=resident.pop(name,None);self._close_native_values([value])
            if getattr(self,'active',None)==name:self.instance=None;self.active=None
            gc.collect()
            if not isolated:
                import torch
                torch.cuda.empty_cache()
        isolated = getattr(self,'isolated_native',False) and name in ('xlmr','e4','phq8')
        report = getattr(self,'native_progress',None) if isolated else None
        def progress(value):
            if report:
                report({**value,'component':{'xlmr':'safety','e4':'emotion','phq8':'phq'}[name]})
        return load_with_retries(name,lambda:self._load_native_once(name) if isolated else self._load_once(name),cleanup,
                                 report=progress if report else None,cancelled=getattr(self,'operation_cancelled',None))

    def _load_once(self, name):
        buddy = getattr(self, "buddy", None)
        cbt = getattr(buddy, "workers", {}).get("cbt") if buddy else None
        if name in ("xlmr", "e4", "phq8") and cbt and cbt.process.poll() is None:
            raise TalkBusyError("Buddy residency has priority")
        if getattr(self, "buddy", None):
            self.buddy.evict()
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
        from app.buddy.gpu_memory import global_memory

        hf=getattr(self,'hf_runtime',None)
        base_ready=bool(hf and hf.worker and hf.worker.process.poll() is None)
        shared_count=(len({id(v) for name,v in self.resident.items() if name!='phq8'})+int(base_ready)
                      +sum(name in self.buddy.workers and self.buddy.workers[name].process.poll() is None for name in ('nano','moss'))
                      if getattr(self,'hf_enabled',False) else None)
        return {
            "buddy": self.buddy.status if getattr(self, "buddy", None) else None,
            "ready": self.loaded,
            "sharedBasePid": (self.hf_runtime.worker.process.pid if getattr(self,"hf_runtime",None) and self.hf_runtime.worker and self.hf_runtime.worker.process.poll() is None else None),
            "baseReady": bool(getattr(self,"hf_runtime",None) and self.hf_runtime.worker and self.hf_runtime.worker.process.poll() is None),
            "startupResident": bool(getattr(self,"hf_runtime",None) and self.hf_runtime.keep_loaded),
            "talkActive": bool(getattr(self,"talk",None) and self.talk.owner),
            "screeningReady": getattr(self,"screening_unavailable",None) is None,
            "activeModel": self.active,
            "residentModelCount": shared_count if shared_count is not None else (len({id(v[0] if isinstance(v, tuple) else v) for v in self.resident.values()}) if isinstance(getattr(self, "resident", None), dict)
                                   else int(self.instance is not None or self.active == "speech"))
                                  + (sum(kind in self.buddy.workers and self.buddy.workers[kind].process.poll() is None for kind in ("cbt", "nano"))
                                     if getattr(self, "buddy", None) else int(bool(getattr(self,"talk",None) and self.talk.owner and self.talk.device=="cuda" and self.talk.process is not None))),
            "freeGpuBytes": global_memory(torch)["freeBytes"],
            "speechPeakAllocatedBytes": getattr(self,"speech_peak_allocated",None),
            "peakAllocatedBytes": torch.cuda.max_memory_allocated(),
            "loadMilliseconds": self.load_milliseconds.copy(),
            "modelLoadCounts": getattr(self, "load_counts", {}).copy(),
            "residentModels": sorted(self.resident) if isinstance(getattr(self, "resident", None), dict) else [],
        }

    def call(self, name, fn):
        self.require_ready()
        if name in ("xlmr", "e4", "phq8") and getattr(self, "journal_paused", False):
            raise TalkBusyError("Journal page is inactive")
        if getattr(self,"talk",None) and self.talk.owner and not getattr(self._talk_context,"active",False) and not getattr(self,"hf_enabled",False):raise TalkBusyError("Talk has priority between stages")
        if not self.slots.acquire(blocking=False):
            raise ModelUnavailableError("Inference queue is full.")
        try:
            if not self.lock.acquire(timeout=30):
                raise ModelUnavailableError("Inference queue timed out.")
            try:
                if getattr(self,"talk",None) and self.talk.owner and not getattr(self._talk_context,"active",False) and not getattr(self,"hf_enabled",False):raise TalkBusyError("Talk has priority between stages")
                try:
                    return fn(self._load(name))
                except Exception as error:
                    from app.model.loading_policy import NativeLoadError,ComponentOperationError
                    if isinstance(error,ComponentOperationError):
                        resident=getattr(self,'resident',{})
                        value=resident.pop(name,None) if isinstance(resident,dict) else None
                        self._close_native_values([value])
                        if getattr(self,'active',None)==name:self.active=None;self.instance=None
                        report=getattr(self,'native_progress',None)
                        if report:report({'component':{'xlmr':'safety','e4':'emotion','phq8':'phq'}[name],'state':'failed','attempt':1,'maxAttempts':5,'code':str(error),'retryable':False})
                    if not isinstance(error,(TalkCancelledError,TalkBusyError,NativeLoadError,ComponentOperationError)):self.release()
                    raise
            finally:
                self.lock.release()
        finally:
            self.slots.release()

    def classify(self, text, language="unknown"):
        if getattr(getattr(self,"_talk_context",None),"active",False):return self._talk_classifier.classify(text,language=language)
        if not isinstance(text, str) or not text.strip() or len(text) > 20000:
            raise ValueError("Invalid journal text.")
        return self.call("xlmr", lambda m: m.call(text, language, getattr(self,"operation_cancelled",None)) if getattr(self,"isolated_native",False) else m.classify(text, language=language))

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

    def emotions(self, text):
        if getattr(self,'isolated_native',False):
            return self.call('e4',lambda m:m.call(text,cancelled=getattr(self,'operation_cancelled',None)))
        from app.vendor.e4.inference import infer_journal
        return self.call("e4", lambda m: infer_journal(m[0], m[1], m[3], text))

    def estimate_distress(self, text):
        from app.model.distress_estimate import result
        if not getattr(self, 'hf_enabled', False):
            return result('unavailable')
        handle = None
        try:
            self.ensure_buddy_capacity()
            handle = self.hf_runtime.acquire('distress', self.operation_cancelled)
            return handle.call({'distressText': text}, self.operation_cancelled)
        except (TalkBusyError, TalkCancelledError):
            raise
        except ModelUnavailableError:
            return result('failed')
        finally:
            if handle is not None:
                handle.close()

    def analyze(self, text, language="unknown", classification=None, emotion=None, screening_result=None):
        classification = classification or self.classify(text, language)
        emotion = emotion if emotion is not None else self.emotions(text)
        category = classification["distress_category"]
        features = {
            "Anxious": "paced_breathing",
            "Depressed": "behavioral_activation",
            "Frustrated": "grounding",
            "Suicidal": "support_connection",
            "Others": "grounding",
        }
        try:
            screening=screening_result if screening_result is not None else self.screening(text)
        except TalkBusyError:
            raise
        except Exception:
            screening={'status':'unavailable' if getattr(self,'screening_unavailable',None) else 'failed','experimental':True,'inferenceVersion':'journal-nullable-v1','items':None,'coverage':0,'subtotal':None,'total':None}
        return {
            "schemaVersion": "echo-journal-analysis-v3",
            "journalScreening":screening,
            "distressEstimate":self.estimate_distress(text),
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
        if getattr(self, "buddy", None):
            return self.buddy.generate(messages)
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
        from app.model.face_transport import FaceRuntime
        runtime = FaceRuntime(self.root)
        try:
            return runtime.predict(encoded)
        finally:
            runtime.close()

    def screening(self,text):
        if getattr(self,'screening_unavailable',None):raise ModelUnavailableError('NATIVE_PHQ_ASSET_UNAVAILABLE')
        if not isinstance(text,str) or not text.strip() or len(text)>20000:raise ValueError('Invalid journal text')
        from app.model.screening import infer
        result=self.call('phq8',lambda m:(m.screening(text,getattr(self,'operation_cancelled',None)) if hasattr(m,'screening') else m.call(text,cancelled=getattr(self,'operation_cancelled',None))) if getattr(self,'isolated_native',False) else infer(m[0],m[1],text))
        result.update(self.screening_provenance())
        return result

    def screening_phase(self, text, check=False):
        if not getattr(self, 'hf_enabled', False):
            raise ModelUnavailableError('NATIVE_PHQ_SHARED_PROFILE_REQUIRED')
        if getattr(self, 'screening_unavailable', None):
            raise ModelUnavailableError('NATIVE_PHQ_ASSET_UNAVAILABLE')
        result = self.call('phq8', lambda worker: worker.phq_pass(text, check, getattr(self, 'operation_cancelled', None)))
        return {**result, 'provenance': self.screening_provenance()}

    def screening_provenance(self):
        from app.model.screening import VERSION
        files=[(v['path'],v['sha256']) for v in self.manifest['files'] if v['path'].startswith(('phq8-seallms/','cbt/base/'))]
        code=Path(__file__).with_name('screening.py').read_bytes()
        provenance = {'modelFingerprint':hashlib.sha256(json.dumps(files,sort_keys=True).encode()).hexdigest(),'inferenceVersion':VERSION+':'+hashlib.sha256(code).hexdigest()[:16]}
        if getattr(self, 'hf_enabled', False):
            provenance['executionEngine'] = 'transformers-peft-shared-nf4-v1'
        if getattr(self, 'shared_enabled', False):
            lock = json.loads((Path(__file__).parents[1]/'buddy/shared-seallms.lock.json').read_text(encoding='utf-8'))
            provenance['runtimeEngine'] = {'name':'shared-seallms-llama-cpp', 'version':lock['llamaCommit'],
                'baseSHA256':lock['model']['sha256'], 'adapterSHA256':lock['adapters']['phq']['sha256'], 'quantization':'Q4_K_M'}
        return provenance
