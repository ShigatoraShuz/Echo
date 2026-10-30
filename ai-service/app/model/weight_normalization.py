"""Lossless, offline architecture-specific safetensors key normalization.

Only documented RoBERTa LayerNorm aliases are accepted, and only when the entire
result exactly covers the installed architecture. No weights are initialized or
changed. Serving adapters keep their original strict canonical-key prechecks.
"""

import hashlib
import json
import re
import struct
from pathlib import Path

from app.model.manifest import ManifestError
from app.model.research_adapters import verify_tensors
from app.model.research_conversion import sha256


def expected_model(config, architecture):
    import torch
    from transformers import (
        RobertaConfig,
        RobertaModel,
        XLMRobertaConfig,
        XLMRobertaForSequenceClassification,
    )

    if config.get("auto_map") or config.get("architectures") != [architecture]:
        raise ManifestError("ARCHITECTURE_MISMATCH")
    if (
        not 1 <= config.get("num_hidden_layers", 0) <= 48
        or not 1 <= config.get("hidden_size", 0) <= 4096
    ):
        raise ManifestError("DIAGNOSTIC_MODEL_BUDGET_EXCEEDED")
    with torch.device("meta"):
        if architecture == "RobertaModel" and config.get("model_type") == "roberta":
            return RobertaModel(RobertaConfig.from_dict(config), add_pooling_layer=True)
        if (
            architecture == "XLMRobertaForSequenceClassification"
            and config.get("model_type") == "xlm-roberta"
        ):
            return XLMRobertaForSequenceClassification(XLMRobertaConfig.from_dict(config))
    raise ManifestError("UNSUPPORTED_NORMALIZATION_ARCHITECTURE")


def normalize_key(key, architecture, expected):
    if architecture not in ("RobertaModel", "XLMRobertaForSequenceClassification"):
        raise ManifestError("UNSUPPORTED_NORMALIZATION_ARCHITECTURE")
    if key in expected:
        return key
    prefix = "roberta\\." if architecture == "XLMRobertaForSequenceClassification" else ""
    pattern = (
        prefix
        + r"(?:embeddings|encoder\.layer\.[0-9]+\.(?:attention\.output|output))\.LayerNorm\.(gamma|beta)"
    )
    match = re.fullmatch(pattern, key)
    if not match:
        raise ManifestError("UNEXPECTED_CHECKPOINT_PARAMETER")
    suffix = match.group(1)
    candidate = key[: -len(suffix)] + ("weight" if suffix == "gamma" else "bias")
    if candidate not in expected:
        raise ManifestError("UNEXPECTED_CHECKPOINT_PARAMETER")
    return candidate


def normalized_tensor_map(actual, expected, architecture):
    mapped, aliases = {}, {}
    for key, shape in actual.items():
        canonical = normalize_key(key, architecture, expected)
        if canonical in mapped:
            raise ManifestError("NORMALIZATION_KEY_COLLISION")
        mapped[canonical] = tuple(shape)
        if canonical != key:
            aliases[key] = canonical
    if set(mapped) != set(expected) or any(
        mapped[k] != tuple(v.shape) for k, v in expected.items() if k in mapped
    ):
        raise ManifestError("CHECKPOINT_PARAMETERS_MISSING_OR_MISMATCHED")
    return aliases


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ManifestError("NORMALIZATION_KEY_COLLISION")
        result[key] = value
    return result


def normalize_weights(source, destination, config, architecture, expected_source_sha256):
    from safetensors import safe_open

    source, destination = Path(source), Path(destination)
    report_path = destination.with_suffix(".normalization.json")
    if (
        source.is_symlink()
        or destination.exists()
        or report_path.exists()
        or destination.suffix != ".safetensors"
    ):
        raise ManifestError("NORMALIZATION_DESTINATION_MUST_BE_NEW")
    model = expected_model(config, architecture)
    expected = model.state_dict()
    with safe_open(str(source), framework="pt", device="cpu") as tensors:
        actual = {}
        for key in sorted(tensors.keys()):
            tensor = tensors.get_slice(key)
            if tensor.get_dtype() not in ("F32", "F16", "BF16"):
                raise ManifestError("CHECKPOINT_DTYPE_UNSUPPORTED")
            actual[key] = tensor.get_shape()
    aliases = normalized_tensor_map(actual, expected, architecture)
    with source.open("rb") as input_stream:
        prefix = input_stream.read(8)
        if len(prefix) != 8:
            raise ManifestError("INVALID_SAFETENSORS_HEADER")
        header_size = struct.unpack("<Q", prefix)[0]
        if header_size > 16 * 1024**2:
            raise ManifestError("INVALID_SAFETENSORS_HEADER")
        raw = input_stream.read(header_size)
        header = json.loads(raw, object_pairs_hook=_unique_object)
        renamed = {aliases.get(key, key): value for key, value in header.items()}
        encoded = json.dumps(renamed, separators=(",", ":"), ensure_ascii=False).encode("utf8")
        encoded += b" " * ((-len(encoded)) % 8)
        new_prefix = struct.pack("<Q", len(encoded))
        original_hash, output_hash, payload_hash = (
            hashlib.sha256(prefix + raw),
            hashlib.sha256(),
            hashlib.sha256(),
        )
        with destination.open("xb") as output:
            output.write(new_prefix + encoded)
            output_hash.update(new_prefix + encoded)
            while chunk := input_stream.read(4 * 1024**2):
                original_hash.update(chunk)
                payload_hash.update(chunk)
                output_hash.update(chunk)
                output.write(chunk)
    if (
        original_hash.hexdigest() != expected_source_sha256
        or sha256(source) != expected_source_sha256
    ):
        raise ManifestError("SOURCE_CHECKSUM_MISMATCH")
    verify_tensors(destination.parent, [destination.name], expected)
    with destination.open("rb") as output:
        output.seek(8 + len(encoded))
        copied_payload_hash = hashlib.file_digest(output, "sha256").hexdigest()
    if (
        copied_payload_hash != payload_hash.hexdigest()
        or sha256(destination) != output_hash.hexdigest()
    ):
        raise ManifestError("NORMALIZATION_VALUE_MISMATCH")
    report = {
        "schema": "echo-roberta-layernorm-normalization-v1",
        "architecture": architecture,
        "source_sha256": expected_source_sha256,
        "destination_sha256": output_hash.hexdigest(),
        "source_tensor_payload_sha256": payload_hash.hexdigest(),
        "destination_tensor_payload_sha256": copied_payload_hash,
        "tensor_values_preserved": True,
        "complete_tensor_coverage": True,
        "tensor_count": len(actual),
        "key_map": aliases,
        "source_preserved": True,
        "calibration_binding_repaired": False,
    }
    with report_path.open("x", encoding="utf8") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    return report
