"""Explicit version selection and a bounded shared inference executor."""

import asyncio
import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from importlib.metadata import PackageNotFoundError, version

from packaging.specifiers import SpecifierSet

from app.model.adapters import HeavyweightRuntime, RobertaAdapter, synthetic_result
from app.model.manifest import ManifestError, read_manifest

TASKS = ("peak", "distress", "phq8", "cbt", "face")


class ModelRegistry:
    def __init__(self, settings):
        self.settings = settings
        self.entries = {}
        self.errors = {}
        self.adapters = {}
        self.heavy = HeavyweightRuntime()
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="echo-inference")
        self.admitted = 0
        self.slots = threading.BoundedSemaphore(settings.echo_queue_capacity)
        self.slot_lock = threading.Lock()
        self.closed = False
        self.scan()

    def scan(self):
        root = self.settings.echo_models_dir.resolve()
        if not root.is_dir():
            return
        paths = []
        for directory, names, files in os.walk(root, followlinks=False):
            names[:] = [name for name in names if not (
                name.startswith(".") or name.lower().startswith(("tmp", "temp", "incomplete"))
                or name.lower().endswith((".tmp", ".partial", ".incomplete"))
                or os.path.islink(os.path.join(directory, name))
                or os.path.isjunction(os.path.join(directory, name))
            )]
            if "manifest.json" in files:
                from pathlib import Path
                paths.append(Path(directory) / "manifest.json")
        for path in sorted(paths):
            relative = path.relative_to(root)
            if ".engineering" in relative.parts and ".engineering" not in root.parts:
                continue
            if not path.resolve().is_relative_to(root) or any(
                (root.joinpath(*relative.parts[:i])).is_symlink()
                for i in range(1, len(relative.parts) + 1)
            ):
                continue
            try:
                manifest = read_manifest(path, self.settings.echo_execution_mode == "synthetic")
                identity = f"{manifest.model_id}@{manifest.version}"
                if identity in self.entries:
                    self.errors[identity] = "DUPLICATE_MODEL_VERSION"
                    self.entries.pop(identity)
                    continue
                if identity not in self.errors:
                    self.entries[identity] = (path.parent, manifest)
            except (ValueError, OSError, KeyError, TypeError) as error:
                # No local paths, text, credentials or checkpoint contents in status responses.
                self.errors[path.parent.relative_to(root).as_posix()] = (
                    str(error) if isinstance(error, ManifestError) else "INVALID_MANIFEST"
                )

    def selected(self, task):
        identity = self.settings.echo_active_models.get(task)
        if not identity:
            raise ManifestError("MODEL_NOT_ENABLED")
        if identity in self.errors:
            raise ManifestError(self.errors[identity])
        entry = self.entries.get(identity)
        if not entry:
            raise ManifestError("MODEL_MISSING_OR_INVALID")
        root, manifest = entry
        if manifest.task != task or manifest.readiness != "engineering_only":
            raise ManifestError("MODEL_NOT_APPROVED_FOR_ENGINEERING")
        if manifest.family == "qwen2_cbt" and (
            not (self.settings.echo_local_research or (
                self.settings.app_env == "test" and self.settings.echo_consultation_demo))
            or self.settings.echo_execution_mode != "real"
        ):
            raise ManifestError("QWEN_REQUIRES_LOCAL_FICTIONAL_CONSULTATION")
        self.check_frameworks(manifest)
        return root, manifest

    @staticmethod
    def check_frameworks(manifest):
        for package, specifier in manifest.frameworks.items():
            try:
                if version(package) not in SpecifierSet(specifier):
                    raise ManifestError("RUNTIME_VERSION_MISMATCH")
            except PackageNotFoundError as error:
                raise ManifestError("INFERENCE_DEPENDENCY_MISSING") from error

    def base_for(self, manifest):
        identity = f"{manifest.base_model_id}@{manifest.base_version}"
        if identity not in self.entries:
            raise ManifestError("BASE_WEIGHTS_MISSING")
        root, base = self.entries[identity]
        if (
            base.task != "base"
            or base.family != manifest.family
            or base.architecture != manifest.architecture
            or base.readiness != "engineering_only"
        ):
            raise ManifestError("BASE_ADAPTER_MISMATCH")
        allowed = {"LlamaForCausalLM", "MistralForCausalLM", "Qwen2ForCausalLM"}
        if base.architecture not in allowed:
            raise ManifestError("UNSUPPORTED_BASE_ARCHITECTURE")
        # Architecture alone does not establish model identity. The reviewed base ID,
        # provenance and adapter base_model_name_or_path must all match exactly.
        if base.provenance.get("upstream_model_id") != manifest.base_model_id:
            raise ManifestError("BASE_PROVENANCE_MISMATCH")
        adapter = json.loads(
            (
                self.entries[f"{manifest.model_id}@{manifest.version}"][0] / "adapter_config.json"
            ).read_text()
        )
        if adapter["base_model_name_or_path"] != base.model_id:
            raise ManifestError("BASE_ADAPTER_MISMATCH")
        self.check_frameworks(base)
        if any(
            manifest.sha256.get(name) != base.sha256.get(name) for name in manifest.tokenizer_files
        ):
            raise ManifestError("ADAPTER_TOKENIZER_MISMATCH")
        return root, base

    def status(self):
        statuses = {}
        for task in TASKS:
            try:
                _, manifest = self.selected(task)
                if task == "face":
                    raise ManifestError("FACE_EXPORT_NOT_READY")
                if task in ("cbt", "phq8") and manifest.family not in ("synthetic", "qwen2_cbt"):
                    self.base_for(manifest)
                statuses[task] = {
                    "status": "validated_not_loaded",
                    "modelId": manifest.model_id,
                    "modelVersion": manifest.version,
                }
            except ManifestError as error:
                statuses[task] = {"status": "unavailable", "errorCode": str(error)}
        return {
            "executionMode": self.settings.echo_execution_mode,
            "models": statuses,
            "invalidArtifacts": self.errors,
            "heavyweightResidents": int(self.heavy.identity is not None),
            "heavyweightLoads": self.heavy.loads,
            "participantActivation": False,
        }

    def infer(self, task, text, context):
        root, manifest = self.selected(task)
        if task == "face":
            raise ManifestError("FACE_EXPORT_NOT_READY")
        if manifest.export_format == "synthetic_fixture":
            return synthetic_result(task), manifest
        if manifest.family == "qwen2_cbt":
            from app.model.qwen_cbt_adapter import QwenCbtAdapter

            key = (manifest.model_id, manifest.version)
            if key not in self.adapters:
                self.adapters[key] = QwenCbtAdapter(root, manifest, self.settings.echo_cpu_threads)
            return self.adapters[key].generate(
                text, context, self.settings.max_new_tokens
            ), manifest
        if task in ("peak", "distress"):
            key = (manifest.model_id, manifest.version)
            if key not in self.adapters:
                if manifest.architecture == "EchoE4RobertaMultiHead":
                    from app.model.research_adapters import E4EmotionAdapter

                    adapter = E4EmotionAdapter
                elif manifest.architecture == "XLMRobertaForSequenceClassification":
                    from app.model.research_adapters import XlmRobertaDistressAdapter

                    adapter = XlmRobertaDistressAdapter
                else:
                    adapter = RobertaAdapter
                self.adapters[key] = adapter(root, manifest, self.settings.echo_cpu_threads)
            return self.adapters[key].infer(text), manifest
        base_root, base = self.base_for(manifest)
        return self.heavy.generate(
            root,
            manifest,
            base_root,
            base,
            text,
            context,
            self.settings.max_new_tokens,
            self.settings.echo_stage_timeout_seconds,
        ), manifest

    async def stage(self, task, text, context=None):
        now = datetime.now(UTC).isoformat()
        identity = self.settings.echo_active_models.get(task, "").rsplit("@", 1)
        stage = {
            "status": "unavailable",
            "modelId": identity[0] or None,
            "modelVersion": identity[1] if len(identity) == 2 else None,
            "executionMode": self.settings.echo_execution_mode,
            "timestamp": now,
            "result": None,
            "errorCode": None,
            "durationMs": 0,
            "executionState": "UNAVAILABLE",
        }
        start = time.perf_counter()
        if self.closed or not self.slots.acquire(blocking=False):
            stage["errorCode"] = "INFERENCE_QUEUE_FULL"
            return stage
        with self.slot_lock:
            self.admitted += 1
        future = self.executor.submit(self.infer, task, text, context or [])
        future.add_done_callback(lambda _: self._release())
        wrapped = asyncio.wrap_future(future)
        wrapped.add_done_callback(lambda f: None if f.cancelled() else f.exception())
        try:
            result, manifest = await asyncio.wait_for(
                asyncio.shield(wrapped),
                timeout=self.settings.echo_stage_timeout_seconds,
            )
            stage.update(
                status="completed",
                result=result,
                modelId=manifest.model_id,
                modelVersion=manifest.version,
                executionState="DEMO_FALLBACK"
                if self.settings.echo_execution_mode == "synthetic"
                else "REAL_PROVISIONAL_MODEL",
            )
        except TimeoutError:
            stage.update(status="failed", errorCode="MODEL_TIMEOUT")
        except ManifestError as error:
            stage["errorCode"] = str(error)
        except ImportError:
            stage["errorCode"] = "INFERENCE_DEPENDENCY_MISSING"
        except Exception as error:  # noqa: BLE001 -- contain native adapter failures at the stage boundary
            # Native OOM text can include allocator paths; never return it verbatim.
            stage.update(
                status="failed",
                errorCode=(
                    "MODEL_OUT_OF_MEMORY"
                    if "out of memory" in str(error).lower()
                    else "MODEL_EXECUTION_FAILED"
                ),
            )
        stage["durationMs"] = round((time.perf_counter() - start) * 1000)
        return stage

    def _release(self):
        with self.slot_lock:
            self.admitted -= 1
        self.slots.release()

    def close(self):
        self.closed = True
        self.executor.shutdown(wait=True, cancel_futures=True)
        self.adapters.clear()
        self.heavy.unload()
