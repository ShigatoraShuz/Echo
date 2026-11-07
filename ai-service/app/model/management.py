"""Offline developer CLI. Never imported by HTTP handlers; never executes export code.

Catalog hashing may be cached. Validation, activation and startup always rehash.
Original bundles are immutable; only a newly dropped, manifest-less export is imported.
"""

import argparse
import hashlib
import hmac
import json
import os
import re
import socket
import time
import urllib.request
from pathlib import Path
from importlib.metadata import version as package_version

from app.core.config import Settings
from app.model.manifest import ManifestError, ModelManifest, confined_file, read_manifest
from app.model.registry import ModelRegistry

ROOT = Path(__file__).resolve().parents[3]
MODELS = ROOT / "backend" / "models"
TASKS = ("peak", "distress", "phq8", "cbt", "face", "researchDiagnostic")


def json_file(path):
    if path.is_symlink() or path.stat().st_size > 256_000:
        raise ManifestError("UNSAFE_OR_OVERSIZED_METADATA")
    return json.loads(path.read_text(encoding="utf8"))


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_symlink() or path.parent.is_symlink() or path.parent.is_junction():
        raise ManifestError("UNSAFE_CONFIGURATION_PATH")
    temporary = path.with_name(path.name + f".{os.getpid()}.tmp")
    with temporary.open("x", encoding="utf8") as stream:
        json.dump(data, stream, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


def safe_tree(root):
    """Do not follow links/junctions or descend into internal/incomplete exports."""
    for directory, names, files in os.walk(root, followlinks=False):
        names[:] = sorted(
            n
            for n in names
            if not (
                n.startswith(".")
                or n.lower().startswith(("tmp", "temp", "incomplete"))
                or n.lower().endswith((".tmp", ".partial", ".incomplete"))
                or (Path(directory) / n).is_symlink()
                or os.path.isjunction(Path(directory) / n)
            )
        )
        yield Path(directory), files


class Manager:
    def __init__(self, root=MODELS):
        self.root = Path(root).absolute()
        if self.root.is_symlink() or os.path.isjunction(self.root):
            raise ManifestError("UNSAFE_MODELS_ROOT")
        self.state = self.root / ".local"
        if self.state.is_symlink() or self.state.is_junction():
            raise ManifestError("UNSAFE_CONFIGURATION_PATH")
        self.active_path = self.state / "active.json"
        self.cache_path = self.state / "hash-cache.json"
        self.cache = json_file(self.cache_path) if self.cache_path.exists() else {}
        self.hashed_bytes = 0
        self.cache_hits = 0

    def digest(self, path, fresh=False):
        path = confined_file(self.root, path.relative_to(self.root).as_posix())
        stat = path.stat()
        signature = [stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns, stat.st_ino]
        key = path.relative_to(self.root).as_posix()
        prior = self.cache.get(key)
        # Small metadata is always rehashed, even for catalog display.
        if not fresh and stat.st_size > 1_000_000 and prior and prior["stat"] == signature:
            self.cache_hits += 1
            return prior["sha256"]
        with path.open("rb") as stream:
            value = hashlib.file_digest(stream, "sha256").hexdigest()
        after = path.stat()
        if [after.st_size, after.st_mtime_ns, after.st_ctime_ns, after.st_ino] != signature:
            raise ManifestError("ARTIFACT_CHANGED_DURING_HASHING")
        self.hashed_bytes += stat.st_size
        self.cache[key] = {"stat": signature, "sha256": value}
        return value

    def settings(self):
        return Settings(
            _env_file=None,
            app_env="development",
            echo_execution_mode="real",
            echo_local_research=True,
            ai_service_token="offline-cli-validation-only-token-32",
            echo_models_dir=self.root,
        )

    def import_export(self, directory):
        config_path = directory / "config.json"
        if not config_path.exists():
            if (directory / "adapter_config.json").exists():
                raise ManifestError("EXACT_REVIEWED_LORA_BASE_AND_EXPORT_CONTRACT_REQUIRED")
            raise ManifestError("CONFIG_OR_VERIFIED_CUSTOM_HEAD_SPEC_REQUIRED")
        config = json_file(config_path)
        if (directory / "adapter_config.json").exists():
            raise ManifestError("EXACT_REVIEWED_LORA_BASE_AND_EXPORT_CONTRACT_REQUIRED")
        if config.get("auto_map"):
            raise ManifestError("REMOTE_MODEL_CODE_REFUSED")
        architecture = config.get("architectures", [])
        if architecture not in (["Qwen2ForCausalLM"], ["RobertaForSequenceClassification"]):
            if (directory / "adapter_config.json").exists():
                raise ManifestError("EXACT_REVIEWED_LORA_BASE_AND_EXPORT_CONTRACT_REQUIRED")
            raise ManifestError("UNSUPPORTED_ARCHITECTURE_OR_CUSTOM_HEAD_SPEC_REQUIRED")
        files = []
        for parent, directories, names in os.walk(directory, followlinks=False):
            if any(
                (Path(parent) / n).is_symlink() or (Path(parent) / n).is_junction()
                for n in directories
            ):
                raise ManifestError("SYMLINK_ARTIFACT_REFUSED")
            for name in names:
                path = Path(parent) / name
                confined_file(directory, path.relative_to(directory).as_posix())
                if path.suffix in (".pt", ".pth", ".bin", ".pkl", ".pickle", ".py"):
                    raise ManifestError("UNTRUSTED_SERIALIZATION_REFUSED")
                files.append(path.relative_to(directory).as_posix())
        if any(
            Path(name).name.startswith("heads") and name.endswith(".safetensors") for name in files
        ):
            raise ManifestError("UNSUPPORTED_CUSTOM_HEAD_SPEC_REQUIRED")
        if not {"tokenizer.json", "tokenizer_config.json"}.issubset(files):
            raise ManifestError("TOKENIZER_MISSING")
        if not {"model.safetensors", "model.safetensors.index.json"}.intersection(files):
            raise ManifestError("WEIGHTS_MISSING")
        if "model.safetensors.index.json" in files:
            shards = json_file(directory / "model.safetensors.index.json").get("weight_map", {})
            if not shards or not set(shards.values()).issubset(files):
                raise ManifestError("INCOMPLETE_WEIGHT_SHARDS")
            # Full Qwen adapter deliberately supports its audited unsharded export only.
            if architecture == ["Qwen2ForCausalLM"]:
                raise ManifestError("QWEN_SHARDED_PROFILE_NOT_IMPLEMENTED")
        metadata = json_file(directory / "echo-export.json") if "echo-export.json" in files else {}
        slug = re.sub(r"[^A-Za-z0-9._-]", "-", directory.name)
        model_id, version = (
            metadata.get("model_id", slug),
            metadata.get("version", "local-export-v1"),
        )
        spec = None
        if architecture == ["Qwen2ForCausalLM"]:
            if "inference-spec.json" not in files:
                raise ManifestError("QWEN_REVIEWED_GENERATION_SPEC_REQUIRED")
            spec = json_file(directory / "inference-spec.json")
            if spec.get("schema_version") != "echo-qwen-cbt-inference-v1":
                raise ManifestError("QWEN_REVIEWED_GENERATION_SPEC_REQUIRED")
            task, family = "cbt", "qwen2_cbt"
            if metadata.get("task", task) != task:
                raise ManifestError("TASK_ARCHITECTURE_MISMATCH")
            maximum = metadata.get("max_tokens", 1024)
            if not isinstance(maximum, int) or not 8 <= maximum <= 1024:
                raise ManifestError("QWEN_ENGINEERING_INPUT_LIMIT_MAXIMUM_1024")
            calibration = {
                "semantics": "structured_generation",
                "method": "not_applicable",
                "documentation": "Unvalidated local text generation; no clinical probabilities or training-reference parity.",
            }
        else:
            task, family = metadata.get("task"), "roberta"
            if task not in ("peak", "distress") or not all(
                k in metadata for k in ("max_tokens", "normalization", "semantics", "source")
            ):
                raise ManifestError(
                    "AMBIGUOUS_TASK_REQUIRES_ECHO_EXPORT_TASK_PREPROCESSING_AND_PROVENANCE"
                )
            maximum = metadata["max_tokens"]
            calibration = {
                "semantics": metadata["semantics"],
                "method": "uncalibrated",
                "documentation": "Researcher-declared uncalibrated classifier; not clinically validated.",
            }
            if metadata.get("calibration", "uncalibrated") != "uncalibrated":
                raise ManifestError("VERIFIED_CALIBRATION_CONTRACT_REQUIRED")
        tokenizer_files = [
            n
            for n in files
            if Path(n).name
            in (
                "tokenizer.json",
                "tokenizer_config.json",
                "special_tokens_map.json",
                "vocab.json",
                "merges.txt",
                "tokenizer.model",
                "sentencepiece.bpe.model",
                "chat_template.jinja",
            )
        ]
        labels = config.get("id2label", {})
        if task != "cbt" and config.get("label2id") != {
            labels.get(str(i)): i for i in range(len(labels))
        }:
            raise ManifestError("LABEL_ORDER_MISMATCH")
        manifest = {
            "schema_version": "echo-model-manifest-v1",
            "artifact_kind": "research_checkpoint",
            "model_id": model_id,
            "version": version,
            "task": task,
            "family": family,
            "architecture": architecture[0],
            "export_format": "hf_safetensors",
            "inference_spec_file": "inference-spec.json" if spec else None,
            "research_status": "provisional_nonfinal",
            "files": [n for n in files if n not in tokenizer_files],
            "tokenizer_files": tokenizer_files,
            "labels": [labels.get(str(i)) for i in range(len(labels))] if task != "cbt" else [],
            "preprocessing": {
                "normalization": metadata.get("normalization", "identity"),
                "max_tokens": maximum,
            },
            "calibration": calibration,
            "output_schema": f"echo-{task}-v1",
            "device": "cpu",
            "compute_dtype": "bfloat16" if spec else "float16",
            # Record the runtime that actually checks this new engineering export.
            # Existing manifests retain their own compatibility requirements.
            "frameworks": {
                name: f"=={package_version(name)}"
                for name in ("torch", "transformers", "safetensors")
            },
            "sha256": {n: self.digest(directory / n, fresh=True) for n in files},
            "provenance": {
                "source": metadata.get(
                    "source",
                    "Local researcher-dropped export; provenance is not independently verified.",
                ),
                "scope": "local_fictional_consultation_only",
            },
            "readiness": "engineering_only",
        }
        parsed = ModelManifest.model_validate(manifest)
        # Check tensor completeness and tokenizer/spec before writing a new manifest.
        self.tensor_check(directory, parsed)
        destination = directory / "manifest.json"
        if destination.exists():
            raise ManifestError("ORIGINAL_MANIFEST_PRESERVED")
        with destination.open("x", encoding="utf8") as stream:
            json.dump(parsed.model_dump(), stream, indent=2)

    def tensor_check(self, directory, manifest):
        if manifest.task == "face":
            raise ManifestError("FACE_EXPORT_NOT_READY")
        if manifest.family == "qwen2_cbt":
            import torch
            from safetensors import safe_open
            from transformers import Qwen2Config, Qwen2ForCausalLM

            from app.model.qwen_cbt_adapter import QwenCbtAdapter
            from app.model.research_adapters import verify_tensors

            adapter = QwenCbtAdapter(directory, manifest, 2)
            tokenizer = adapter._load_tokenizer()
            if (
                not tokenizer.chat_template
                or len(tokenizer) > adapter.config_data["vocab_size"]
                or tokenizer.eos_token_id != adapter.config_data["eos_token_id"]
            ):
                raise ManifestError("QWEN_TOKENIZER_MISMATCH")
            config = dict(adapter.config_data)
            rope = config.pop("rope_parameters", None)
            if rope:
                config["rope_theta"] = rope["rope_theta"]
            with torch.device("meta"):
                expected = dict(Qwen2ForCausalLM(Qwen2Config(**config)).state_dict())
            with safe_open(str(directory / "model.safetensors"), framework="pt") as tensors:
                keys = set(tensors.keys())
                if any(tensors.get_slice(k).get_dtype() != "BF16" for k in keys):
                    raise ManifestError("QWEN_DTYPE_MISMATCH")
            if "lm_head.weight" not in keys:
                expected.pop("lm_head.weight", None)
            if sum(tensor.numel() for tensor in expected.values()) > 2_000_000_000:
                raise ManifestError("QWEN_CPU_PARAMETER_BUDGET")
            verify_tensors(directory, ["model.safetensors"], expected)
        elif manifest.task in ("peak", "distress"):
            import torch
            from transformers import AutoTokenizer, RobertaConfig, RobertaForSequenceClassification

            from app.model.research_adapters import verify_tensors
            from app.model.weight_normalization import expected_model

            if manifest.architecture == "EchoE4RobertaMultiHead":
                from transformers import RobertaModel

                from app.model.research_profiles import read_inference_spec

                spec = read_inference_spec(directory, manifest)
                config = RobertaConfig.from_pretrained(
                    str(directory / "encoder"), local_files_only=True
                )
                with torch.device("meta"):
                    model = RobertaModel(config, add_pooling_layer=spec.encoder_pooler)
                    heads = torch.nn.ModuleDict(
                        {
                            name: torch.nn.Linear(config.hidden_size, len(labels))
                            for name, labels in spec.heads.items()
                        }
                    )
                verify_tensors(directory, ["encoder/model.safetensors"], model.state_dict())
                verify_tensors(directory, ["heads.safetensors"], heads.state_dict())
            else:
                config_data = json_file(directory / "config.json")
                if manifest.architecture == "RobertaForSequenceClassification":
                    config = RobertaConfig.from_dict(config_data)
                    with torch.device("meta"):
                        model = RobertaForSequenceClassification(config)
                else:
                    model = expected_model(config_data, manifest.architecture)
                verify_tensors(
                    directory,
                    [n for n in manifest.files if n.endswith(".safetensors")],
                    model.state_dict(),
                )
            tokenizer = AutoTokenizer.from_pretrained(
                str(directory), local_files_only=True, trust_remote_code=False
            )
            if not tokenizer.is_fast or len(tokenizer) != model.config.vocab_size:
                raise ManifestError("TOKENIZER_MODEL_MISMATCH")
            if any(
                getattr(tokenizer, name) != getattr(model.config, name)
                for name in ("bos_token_id", "eos_token_id", "pad_token_id")
            ):
                raise ManifestError("TOKENIZER_MODEL_MISMATCH")
            if manifest.preprocessing.max_tokens > min(
                tokenizer.model_max_length, model.config.max_position_embeddings - 2
            ):
                raise ManifestError("SEQUENCE_LIMIT_MISMATCH")
        elif manifest.task in ("phq8", "cbt"):
            runtime = ModelRegistry(self.settings())
            try:
                runtime.base_for(manifest)
                import torch

                if not torch.cuda.is_available():
                    raise ManifestError("VERIFIED_CUDA_RUNTIME_REQUIRED")
            finally:
                runtime.close()

    def scan(self, fresh=False, import_new=False, fresh_identities=None):
        entries = []
        covered = []
        for directory, names in safe_tree(self.root):
            if any(directory.is_relative_to(parent) for parent in covered):
                continue
            existing = "manifest.json" in names or "diagnostic-manifest.json" in names
            candidate = existing or any(
                n in names
                for n in ("config.json", "adapter_config.json", "heads.pt", "heads.safetensors")
            )
            # Include human-facing empty root folders; not internal task containers.
            if not candidate and directory.parent == self.root and not any(directory.iterdir()):
                entries.append(
                    {"folder": directory.name, "status": "blocked", "reason": "EMPTY_FOLDER"}
                )
                continue
            if not candidate:
                continue
            covered.append(directory)
            item = {"folder": directory.relative_to(self.root).as_posix(), "status": "blocked"}
            try:
                if not existing:
                    if not import_new:
                        raise ManifestError("RUN_MODELS_SCAN_TO_IMPORT_OR_REPORT_MISSING_METADATA")
                    self.import_export(directory)
                if (directory / "diagnostic-manifest.json").exists():
                    from app.model.diagnostic import DiagnosticManifest, validate_diagnostic

                    diagnostic = DiagnosticManifest.model_validate(
                        json_file(directory / "diagnostic-manifest.json")
                    )
                    inspect_fresh = fresh or f"{diagnostic.model_id}@{diagnostic.version}" in (
                        fresh_identities or set()
                    )
                    for name, expected in diagnostic.files.items():
                        if self.digest(confined_file(directory, name), inspect_fresh) != expected:
                            raise ManifestError("CHECKSUM_MISMATCH")
                    if inspect_fresh:
                        validate_diagnostic(directory, self.settings())
                    item.update(
                        identity=f"{diagnostic.model_id}@{diagnostic.version}",
                        task="researchDiagnostic",
                        architecture=diagnostic.architecture,
                        status="diagnostics_only",
                        reason="RAW_UNCALIBRATED_ONLY"
                        if diagnostic.class_labels
                        else "E4_FORWARD_SPEC_REQUIRED",
                    )
                else:
                    descriptor = ModelManifest.model_validate(
                        json_file(directory / "manifest.json")
                    )
                    inspect_fresh = fresh or f"{descriptor.model_id}@{descriptor.version}" in (
                        fresh_identities or set()
                    )
                    manifest = read_manifest(
                        directory / "manifest.json",
                        hash_file=lambda p, verify=inspect_fresh: self.digest(p, verify),
                    )
                    ModelRegistry.check_frameworks(manifest)
                    if inspect_fresh:
                        self.tensor_check(directory, manifest)
                    item.update(
                        identity=f"{manifest.model_id}@{manifest.version}",
                        task=manifest.task,
                        architecture=manifest.architecture,
                        status="engineering_only"
                        if manifest.readiness == "engineering_only"
                        else "disabled",
                    )
            except (ValueError, OSError, KeyError, TypeError) as error:
                item["reason"] = (
                    str(error) if isinstance(error, ManifestError) else "INVALID_EXPORT_METADATA"
                )
            entries.append(item)
        seen = {}
        for item in entries:
            identity = item.get("identity")
            if identity and identity in seen:
                for duplicate in (item, seen[identity]):
                    duplicate.update(status="blocked", reason="DUPLICATE_MODEL_VERSION")
            elif identity:
                seen[identity] = item
        atomic_json(self.cache_path, self.cache)
        return entries

    def selection(self):
        if not self.active_path.exists():
            # One-time migration; all subsequent startup and switching use active.json only.
            legacy = self.root / "consultation-selection.json"
            if legacy.exists():
                old = json_file(legacy)
                if old.get("schemaVersion") != "echo-consultation-selection-v1":
                    raise ManifestError("INVALID_LEGACY_SELECTION")
                self.save_selection(
                    {"cbt": old["cbtGeneration"], "researchDiagnostic": old["researchDiagnostic"]},
                    None,
                )
            else:
                self.save_selection({}, None)
        config = json_file(self.active_path)
        if (
            config.get("schemaVersion") != "echo-local-model-selection-v1"
            or not isinstance(config.get("tasks"), dict)
            or not set(config["tasks"]).issubset(TASKS)
        ):
            raise ManifestError("INVALID_LOCAL_SELECTION")
        return config

    def save_selection(self, tasks, previous):
        atomic_json(
            self.active_path,
            {
                "schemaVersion": "echo-local-model-selection-v1",
                "tasks": tasks,
                "previous": previous,
                "updatedAt": time.time(),
            },
        )

    def activate(self, task, model=None, rollback=False):
        self.state.mkdir(parents=True, exist_ok=True)
        lock = self.state / "activation.lock"
        try:
            with lock.open("x", encoding="utf8") as stream:
                stream.write(str(os.getpid()))
        except FileExistsError:
            raise ManifestError(
                "ANOTHER_ACTIVATION_IS_RUNNING_OR_REQUIRES_OPERATOR_LOCK_REVIEW"
            ) from None
        try:
            return self._activate(task, model, rollback)
        finally:
            lock.unlink()

    def _activate(self, task, model=None, rollback=False):
        # No live mutation or public reload: stop the stack before changing configuration.
        for port in (3000, 4300, 8100):
            with socket.socket() as connection:
                connection.settimeout(0.2)
                if connection.connect_ex(("127.0.0.1", port)) == 0:
                    raise ManifestError("STOP_LOCAL_DEV_WITH_CTRL_C_BEFORE_MODEL_SWITCH")
        config = self.selection()
        if rollback:
            target = config.get("previous")
            if not target:
                raise ManifestError("NO_PREVIOUS_SELECTION")
        else:
            entries = self.scan()
            matches = [
                e
                for e in entries
                if e.get("identity") == model
                or e["folder"] == model
                or e["folder"].split("/")[-1] == model
            ]
            if len(matches) != 1:
                raise ManifestError("MODEL_SELECTION_MISSING_OR_AMBIGUOUS")
            entry = matches[0]
            if (
                entry.get("task") != task
                or entry["status"] not in ("engineering_only", "diagnostics_only")
                or entry.get("reason") == "E4_FORWARD_SPEC_REQUIRED"
            ):
                raise ManifestError(entry.get("reason", "MODEL_TASK_OR_READINESS_MISMATCH"))
            target = {**config["tasks"], task: entry["identity"]}
        self.validate_selection(target)
        self.save_selection(target, config["tasks"])
        return self.selection()

    def validate_selection(self, tasks=None, all_exports=False):
        tasks = self.selection()["tasks"] if tasks is None else tasks
        entries = self.scan(fresh=all_exports, fresh_identities=set(tasks.values()))
        for task, identity in tasks.items():
            matches = [
                e for e in entries if e.get("identity") == identity and e.get("task") == task
            ]
            if (
                len(matches) != 1
                or matches[0]["status"] not in ("engineering_only", "diagnostics_only")
                or matches[0].get("reason") == "E4_FORWARD_SPEC_REQUIRED"
            ):
                raise ManifestError(f"ACTIVE_MODEL_INVALID:{task}")
        return {"tasks": tasks, "models": entries}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command", choices=("scan", "list", "validate", "status", "activate", "prepare")
    )
    parser.add_argument("--task", choices=TASKS)
    parser.add_argument("--model")
    parser.add_argument("--rollback", action="store_true")
    args = parser.parse_args()
    if os.environ.get("NODE_ENV") == "production" or os.environ.get("APP_ENV") == "production":
        parser.error("Filesystem model management is local development only.")
    manager = Manager()
    try:
        if args.command == "activate":
            if not args.rollback and (not args.task or not args.model):
                parser.error("activate requires --task and --model (or --rollback)")
            output = manager.activate(args.task, args.model, args.rollback)
            output["restartRequired"] = "Start npm run dev to use this selection."
        elif args.command in ("prepare", "validate"):
            output = manager.validate_selection(all_exports=args.command == "validate")
            if args.command == "validate":
                output["blockedExports"] = [e for e in output["models"] if e["status"] == "blocked"]
        else:
            output = {
                "selection": manager.selection(),
                "models": manager.scan(import_new=args.command == "scan"),
            }
            if args.command == "status":
                runtime_path = ROOT / "backend/tmp/development-runtime/runtime.json"
                runtime = json_file(runtime_path) if runtime_path.exists() else None
                live_ports = {}
                for port in (3000, 4300, 8100):
                    with socket.socket() as sock:
                        sock.settimeout(0.2)
                        live_ports[str(port)] = sock.connect_ex(("127.0.0.1", port)) == 0
                output.update(
                    runtime=runtime,
                    listening=live_ports,
                    effectiveState="running; compare runtime.models to selection"
                    if all(live_ports.values())
                    else "stopped or degraded; no inference readiness claim",
                )
                private_path = ROOT / "backend/.local-development/private.json"
                if live_ports["8100"] and private_path.exists():
                    try:
                        private = json_file(private_path)
                        token = hmac.new(
                            private["registrationSecret"].encode(), b"model-service-v1", "sha256"
                        ).hexdigest()
                        request = urllib.request.Request(
                            "http://127.0.0.1:8100/engineering/v2/models",
                            headers={"Authorization": f"Bearer {token}"},
                        )

                        # No environment proxies, redirects, external destinations or service key.
                        class NoRedirect(urllib.request.HTTPRedirectHandler):
                            def redirect_request(self, *_):
                                return None

                        opener = urllib.request.build_opener(
                            urllib.request.ProxyHandler({}), NoRedirect()
                        )
                        with opener.open(request, timeout=3) as response:
                            content = response.read(256_001)
                            if len(content) > 256_000:
                                raise ValueError("Oversized internal response")
                            output["liveRegistry"] = json.loads(content)
                    except (ValueError, OSError, KeyError):
                        output["liveRegistry"] = {
                            "status": "unavailable",
                            "reason": "INTERNAL_REGISTRY_READINESS_FAILED",
                        }
                output["configurationMatchesRuntime"] = bool(
                    runtime and runtime.get("models") == output["selection"]["tasks"]
                )
                output["runtimeHeartbeatFresh"] = bool(
                    runtime and 0 <= time.time() * 1000 - runtime.get("lastCheckedAt", 0) < 45000
                )
                live = output.get("liveRegistry", {})
                registry_matches = live.get("executionMode") == "real" and all(
                    live.get("models", {}).get(task, {}).get("status") == "validated_not_loaded"
                    and f"{live['models'][task].get('modelId')}@{live['models'][task].get('modelVersion')}"
                    == identity
                    for task, identity in output["selection"]["tasks"].items()
                    if task != "researchDiagnostic"
                )
                output["effectiveState"] = (
                    "ready; weights load lazily"
                    if (
                        all(live_ports.values())
                        and output["configurationMatchesRuntime"]
                        and output["runtimeHeartbeatFresh"]
                        and runtime.get("state") == "ready"
                        and registry_matches
                    )
                    else "stopped, degraded, stale or configuration mismatch; inspect runtime and liveRegistry"
                )
        output.update(
            hashedBytes=manager.hashed_bytes,
            catalogCacheHits=manager.cache_hits,
            participantActivation=False,
            productionActivation=False,
        )
        print(json.dumps(output, indent=2))
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(
            json.dumps(
                {
                    "error": str(error)
                    if isinstance(error, ManifestError)
                    else "INVALID_MODEL_CONFIGURATION"
                }
            )
        )
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
