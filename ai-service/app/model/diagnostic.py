"""Local-only component diagnostics, deliberately outside the student result contract.

An encoder result is not an emotion prediction. Raw XLM-R logits are not calibrated
probabilities. This schema cannot register a model in ModelRegistry or enable serving.
"""

import json
import math
import re
import time
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.model.manifest import ManifestError, confined_file
from app.model.research_adapters import verify_tensors
from app.model.research_conversion import sha256
from app.model.weight_normalization import expected_model


class DiagnosticManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal["echo-checkpoint-diagnostic-v1"]
    artifact_kind: Literal["research_checkpoint", "synthetic_engineering"]
    model_id: str = Field(min_length=2, max_length=160)
    version: str = Field(min_length=1, max_length=80)
    architecture: Literal["RobertaModel", "XLMRobertaForSequenceClassification"]
    research_status: Literal["provisional_nonfinal"]
    readiness: Literal["diagnostics_only"]
    application_eligible: Literal[False]
    calibration_applied: Literal[False]
    max_tokens: int = Field(ge=8, le=384)
    input_policy: Literal["literal_text_saved_tokenizer_single_window_reject_overflow"]
    external_preprocessing_verified: Literal[False]
    class_labels: list[str]
    head_labels: dict[str, list[str]]
    original_weight_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    calibration_expected_weight_sha256: str | None
    calibration_binding: Literal["mismatch_unresolved", "unverified", "not_available"]
    source_reference: str = Field(min_length=10, max_length=1000)
    files: dict[str, str] = Field(min_length=5, max_length=40)


def _json(root, name):
    path = confined_file(root, name)
    if path.stat().st_size > 128_000:
        raise ManifestError("DIAGNOSTIC_METADATA_TOO_LARGE")
    return json.loads(path.read_text(encoding="utf8"))


def validate_diagnostic(root, settings):
    root = Path(root)
    if settings.app_env == "production":
        raise ManifestError("DIAGNOSTICS_DISABLED_IN_PRODUCTION")
    manifest = DiagnosticManifest.model_validate(_json(root, "diagnostic-manifest.json"))
    for labels in [manifest.class_labels, *manifest.head_labels.values()]:
        if len(set(labels)) != len(labels) or any(not v.strip() for v in labels):
            raise ManifestError("LABEL_ORDER_MISMATCH")
    if manifest.artifact_kind == "synthetic_engineering" and (
        settings.echo_execution_mode != "synthetic" or settings.app_env != "test"
    ):
        raise ManifestError("SYNTHETIC_ARTIFACT_REFUSED")
    required = {
        "config.json",
        "model.safetensors",
        "model.normalization.json",
        "tokenizer.json",
        "tokenizer_config.json",
    }
    if manifest.architecture == "RobertaModel":
        required |= {"heads.safetensors", "heads.conversion.json", "e4_config.json"}
    else:
        required |= {"source-calibration.json", "source-training-manifest.json"}
    if not required.issubset(manifest.files):
        raise ManifestError("DIAGNOSTIC_ARTIFACT_MISSING")
    for name, expected in manifest.files.items():
        path = confined_file(root, name)
        if path.suffix not in (".json", ".safetensors", ".txt", ".model"):
            raise ManifestError("UNTRUSTED_SERIALIZATION_REFUSED")
        if len(expected) != 64 or sha256(path) != expected:
            raise ManifestError("CHECKSUM_MISMATCH")
    for path in root.rglob("*"):
        if (
            path.is_file()
            and path.name != "diagnostic-manifest.json"
            and path.relative_to(root).as_posix() not in manifest.files
        ):
            raise ManifestError("UNDECLARED_MODEL_ARTIFACT")
    config = _json(root, "config.json")
    model = expected_model(config, manifest.architecture)
    verify_tensors(root, ["model.safetensors"], model.state_dict())
    report = _json(root, "model.normalization.json")
    if (
        report.get("source_sha256") != manifest.original_weight_sha256
        or report.get("destination_sha256") != manifest.files["model.safetensors"]
        or report.get("source_tensor_payload_sha256")
        != report.get("destination_tensor_payload_sha256")
        or report.get("tensor_values_preserved") is not True
        or report.get("complete_tensor_coverage") is not True
        or not isinstance(report.get("source_tensor_payload_sha256"), str)
        or not re.fullmatch(r"[a-f0-9]{64}", report.get("source_tensor_payload_sha256", ""))
    ):
        raise ManifestError("NORMALIZATION_PROVENANCE_MISMATCH")
    if manifest.architecture == "RobertaModel":
        import torch

        e4 = _json(root, "e4_config.json")
        if manifest.class_labels or manifest.head_labels != {
            "plutchik": e4.get("plutchik_labels"),
            "goemotions": e4.get("goemotions_labels"),
        }:
            raise ManifestError("E4_HEAD_LABEL_MISMATCH")
        if (
            len(manifest.head_labels["plutchik"]) != 8
            or len(manifest.head_labels["goemotions"]) != 27
        ):
            raise ManifestError("E4_HEAD_LABEL_MISMATCH")
        with torch.device("meta"):
            heads = torch.nn.ModuleDict(
                {
                    name: torch.nn.Linear(config["hidden_size"], len(labels))
                    for name, labels in manifest.head_labels.items()
                }
            )
        verify_tensors(root, ["heads.safetensors"], heads.state_dict())
        converted = _json(root, "heads.conversion.json")
        if (
            converted.get("ordered_head_labels") != manifest.head_labels
            or converted.get("destination_sha256") != manifest.files["heads.safetensors"]
            or converted.get("tensor_values_preserved") is not True
        ):
            raise ManifestError("HEAD_CONVERSION_PROVENANCE_MISMATCH")
        if (
            manifest.calibration_expected_weight_sha256 is not None
            or manifest.calibration_binding != "not_available"
        ):
            raise ManifestError("E4_CALIBRATION_UNVERIFIED")
    else:
        labels = [config.get("id2label", {}).get(str(i)) for i in range(5)]
        if (
            len(config.get("id2label", {})) != 5
            or manifest.class_labels != labels
            or manifest.head_labels
        ):
            raise ManifestError("LABEL_ORDER_MISMATCH")
        calibration, training = (
            _json(root, "source-calibration.json"),
            _json(root, "source-training-manifest.json"),
        )
        expected = manifest.calibration_expected_weight_sha256
        if (
            not expected
            or calibration.get("model_weights_sha256") != expected
            or training.get("model_weights_sha256") != expected
            or calibration.get("class_order") != labels
            or training.get("class_order") != labels
        ):
            raise ManifestError("CALIBRATION_PROVENANCE_MISMATCH")
        required_binding = (
            "mismatch_unresolved" if expected != manifest.original_weight_sha256 else "unverified"
        )
        if manifest.calibration_binding != required_binding:
            raise ManifestError("CALIBRATION_MISMATCH_MUST_REMAIN_VISIBLE")
    return manifest, config


def _load_exact_cpu(model, root, filename):
    import torch
    from safetensors.torch import load_file

    verify_tensors(root, [filename], model.state_dict())
    state = load_file(root / filename, device="cpu")
    result = model.load_state_dict(state, strict=True, assign=True)
    if (
        result.missing_keys
        or result.unexpected_keys
        or any(p.is_meta or p.device.type != "cpu" for p in model.parameters())
    ):
        raise ManifestError("CHECKPOINT_PARAMETERS_MISSING_OR_MISMATCHED")
    # These nonpersistent HF buffers are deterministic constants, not learned
    # checkpoint parameters. Never use to_empty/random initialization for layers.
    for name, buffer in list(model.named_buffers()):
        if not buffer.is_meta:
            continue
        parent_name, _, leaf = name.rpartition(".")
        if parent_name not in ("embeddings", "roberta.embeddings") or leaf not in (
            "position_ids",
            "token_type_ids",
        ):
            raise ManifestError("UNINITIALIZED_MODEL_BUFFER")
        parent = model.get_submodule(parent_name)
        positions = model.config.max_position_embeddings
        value = (
            torch.arange(positions, dtype=torch.long).expand(1, -1)
            if leaf == "position_ids"
            else torch.zeros((1, positions), dtype=torch.long)
        )
        if tuple(value.shape) != tuple(buffer.shape):
            raise ManifestError("MODEL_BUFFER_SHAPE_MISMATCH")
        parent.register_buffer(leaf, value, persistent=False)
    return model.eval()


def run_diagnostic(root, settings, text, exploratory_pooling=None):
    import torch
    from transformers import AutoTokenizer

    if exploratory_pooling not in (None, "cls", "masked_mean"):
        raise ManifestError("UNKNOWN_EXPLORATORY_POOLING")
    started = time.perf_counter()
    root = Path(root)
    manifest, config = validate_diagnostic(root, settings)
    torch.set_num_threads(settings.echo_cpu_threads)
    if not text.strip() or len(text) > 20_000:
        raise ManifestError("INVALID_DIAGNOSTIC_INPUT")
    tokenizer = AutoTokenizer.from_pretrained(
        str(root), local_files_only=True, trust_remote_code=False, use_fast=True
    )
    expected_tokenizer = (
        "RobertaTokenizerFast"
        if manifest.architecture == "RobertaModel"
        else "XLMRobertaTokenizerFast"
    )
    if (
        type(tokenizer).__name__ not in (expected_tokenizer,expected_tokenizer.removesuffix('Fast'))
        or not tokenizer.is_fast
        or len(tokenizer) != config["vocab_size"]
        or any(
            getattr(tokenizer, k) != config[k]
            for k in ("bos_token_id", "eos_token_id", "pad_token_id")
        )
    ):
        raise ManifestError("TOKENIZER_MODEL_MISMATCH")
    saved = tokenizer.backend_tokenizer.truncation
    if not saved or saved["max_length"] != manifest.max_tokens:
        raise ManifestError("SAVED_DIAGNOSTIC_SEQUENCE_LIMIT_MISMATCH")
    batch = tokenizer(text, add_special_tokens=True, truncation=False, return_tensors="pt")
    if batch["input_ids"].shape[1] > min(
        manifest.max_tokens, config["max_position_embeddings"] - 2
    ):
        raise ManifestError("DIAGNOSTIC_SINGLE_WINDOW_ONLY")
    model = _load_exact_cpu(
        expected_model(config, manifest.architecture), root, "model.safetensors"
    )
    result = {
        "schema_version": "echo-checkpoint-diagnostic-result-v1",
        "model_id": manifest.model_id,
        "version": manifest.version,
        "artifact_kind": manifest.artifact_kind,
        "weights_loaded": True,
        "device": "cpu",
        "input_tokens": int(batch["input_ids"].shape[1]),
        "max_tokens": manifest.max_tokens,
        "windows": 1,
        "input_policy": manifest.input_policy,
        "external_preprocessing_verified": False,
        "application_eligible": False,
        "training_reference_parity": "unverified",
        "calibration_binding": manifest.calibration_binding,
        "calibration_applied": False,
        "thresholds_applied": False,
        "probabilities": None,
    }
    result["validation_and_load_ms"] = round((time.perf_counter() - started) * 1000)
    with torch.inference_mode():
        encoder = model if manifest.architecture == "RobertaModel" else model.roberta
        start = time.perf_counter()
        hidden = encoder(**batch).last_hidden_state
        if not torch.isfinite(hidden).all():
            raise ManifestError("INVALID_ENCODER_OUTPUT")
        result.update(
            encoder_forward="completed",
            encoder_output_shape=list(hidden.shape),
            encoder_forward_ms=round((time.perf_counter() - start) * 1000),
        )
        if manifest.architecture == "RobertaModel":
            with torch.device("meta"):
                heads = torch.nn.ModuleDict(
                    {
                        name: torch.nn.Linear(config["hidden_size"], len(labels))
                        for name, labels in manifest.head_labels.items()
                    }
                )
            _load_exact_cpu(heads, root, "heads.safetensors")
            if exploratory_pooling is not None:
                # Explicit reconstruction experiment, never the unconfirmed training recipe.
                pooled = (
                    hidden[:, 0]
                    if exploratory_pooling == "cls"
                    else (
                        (hidden * batch["attention_mask"].unsqueeze(-1)).sum(1)
                        / batch["attention_mask"].sum(1, keepdim=True).clamp(min=1)
                    )
                )
                values = {name: head(pooled)[0].tolist() for name, head in heads.items()}
                if any(not math.isfinite(v) for output in values.values() for v in output):
                    raise ManifestError("NONFINITE_EXPLORATORY_HEAD")
                result["exploratory_reconstruction"] = {
                    "assumption": f"{exploratory_pooling} pooling followed by the loaded linear heads; no activation",
                    "training_forward_verified": False,
                    "student_output_allowed": False,
                    "calibration_applied": False,
                    "probabilities": None,
                    "labels": manifest.head_labels,
                    "raw_head_values": values,
                }
            result.update(
                heads_loaded=True,
                head_labels=manifest.head_labels,
                classifier_forward="blocked",
                classifier_error="E4_FORWARD_SPEC_REQUIRED",
                raw_logits=None,
            )
        else:
            timings, outputs = [], []
            for _ in range(2):
                start = time.perf_counter()
                logits = model(**batch).logits
                timings.append(round((time.perf_counter() - start) * 1000))
                if list(logits.shape) != [1, 5] or not torch.isfinite(logits).all():
                    raise ManifestError("INVALID_CLASSIFIER_OUTPUT")
                outputs.append(logits[0].tolist())
            if any(
                not math.isclose(a, b, rel_tol=1e-6, abs_tol=1e-7)
                for a, b in zip(*outputs, strict=True)
            ):
                raise ManifestError("REPEAT_DIAGNOSTIC_MISMATCH")
            result.update(
                classifier_forward="completed_raw_uncalibrated_diagnostic",
                class_labels=manifest.class_labels,
                raw_logits=outputs[0],
                classifier_forward_ms=timings,
                repeat_consistent=True,
            )
    return result
