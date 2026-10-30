"""Explicit offline tensor conversion, never invoked by serving or registry scanning.

No unrestricted torch.load, safe-global additions, Python checkpoint code or guessed
key mappings. Preserve the original archive and .pt file. This is not a sandbox for
untrusted models; use only the specifically authorized trusted research artifact.
"""

import argparse
import hashlib
import io
import json
import pickletools
import zipfile
from collections import OrderedDict
from pathlib import Path

from app.model.manifest import ManifestError

MAX_HEAD_BYTES = 32 * 1024**2


def sha256(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def _restricted_state(path, expected_sha256):
    import torch

    path = Path(path)
    if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= MAX_HEAD_BYTES:
        raise ManifestError("INVALID_HEAD_SOURCE")
    payload = path.read_bytes()
    if len(payload) > MAX_HEAD_BYTES:
        raise ManifestError("INVALID_HEAD_SOURCE")
    if len(expected_sha256) != 64 or hashlib.sha256(payload).hexdigest() != expected_sha256:
        raise ManifestError("CHECKSUM_MISMATCH")
    try:
        # Inspect pickle opcodes as data BEFORE restricted loading. Torch itself
        # registers some safe globals at import; never trust arbitrary additions
        # made by another library in this process. Only plain CPU tensor builders
        # and OrderedDict are permitted, regardless of that global allowlist.
        allowed = {
            "collections OrderedDict",
            "torch._utils _rebuild_tensor",
            "torch._utils _rebuild_tensor_v2",
            "torch FloatStorage",
            "torch HalfStorage",
            "torch BFloat16Storage",
        }
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            entries = archive.infolist()
            if (
                len(entries) > 256
                or sum(m.file_size for m in entries) > MAX_HEAD_BYTES
                or any(
                    m.flag_bits & 1 or m.file_size > max(1, m.compress_size) * 200 for m in entries
                )
            ):
                raise ManifestError("HEAD_ARCHIVE_BUDGET_EXCEEDED")
            members = [m for m in entries if m.filename.endswith("/data.pkl")]
            if len(members) != 1 or members[0].file_size > 128_000:
                raise ManifestError("PLAIN_HEAD_STATE_DICTIONARY_REQUIRED")
            for opcode, argument, _ in pickletools.genops(archive.read(members[0])):
                if opcode.name == "STACK_GLOBAL" or (
                    opcode.name == "GLOBAL" and argument not in allowed
                ):
                    raise ManifestError("UNSAFE_HEAD_SERIALIZATION_REFUSED")
        if torch.serialization.get_unsafe_globals_in_checkpoint(io.BytesIO(payload)):
            raise ManifestError("UNSAFE_HEAD_SERIALIZATION_REFUSED")
        state = torch.load(io.BytesIO(payload), map_location="cpu", weights_only=True)
    except ManifestError:
        raise
    except Exception as error:
        raise ManifestError("RESTRICTED_HEAD_LOAD_FAILED") from error
    if type(state) not in (dict, OrderedDict) or not 0 < len(state) <= 100:
        raise ManifestError("PLAIN_HEAD_STATE_DICTIONARY_REQUIRED")
    return state


def _validate_flat_tensors(state):
    import torch

    total = 0
    for name, tensor in state.items():
        if (
            not isinstance(name, str)
            or not name
            or len(name) > 200
            or type(tensor) is not torch.Tensor
            or tensor.layout != torch.strided
            or tensor.dtype not in (torch.float32, torch.float16, torch.bfloat16)
            or tensor.ndim not in (1, 2)
            or not 0 < tensor.numel() <= 4_000_000
            or not torch.isfinite(tensor).all()
        ):
            raise ManifestError("INVALID_HEAD_TENSOR")
        total += tensor.numel()
    if total > 4_000_000:
        raise ManifestError("HEAD_TENSOR_BUDGET_EXCEEDED")
    return state


def restricted_heads(path, expected_sha256):
    return _validate_flat_tensors(_restricted_state(path, expected_sha256))


def restricted_e4_heads(path, expected_sha256, labels, hidden_size):
    """Recognize only the inspected nested two-head format; never infer pooling."""
    if (
        set(labels) != {"plutchik", "goemotions"}
        or len(labels["plutchik"]) != 8
        or len(labels["goemotions"]) != 27
        or not isinstance(hidden_size, int)
        or isinstance(hidden_size, bool)
        or not 1 <= hidden_size <= 4096
        or any(
            len(set(values)) != len(values)
            or any(not isinstance(v, str) or not v.strip() for v in values)
            for values in labels.values()
        )
    ):
        raise ManifestError("E4_HEAD_METADATA_MISMATCH")
    nested = _restricted_state(path, expected_sha256)
    if set(nested) != set(labels):
        raise ManifestError("E4_HEAD_COVERAGE_MISMATCH")
    flat = {}
    for head, ordered_labels in labels.items():
        values = nested[head]
        if type(values) not in (dict, OrderedDict) or set(values) != {"weight", "bias"}:
            raise ManifestError("E4_HEAD_COVERAGE_MISMATCH")
        _validate_flat_tensors(values)
        if tuple(values["weight"].shape) != (len(ordered_labels), hidden_size) or tuple(
            values["bias"].shape
        ) != (len(ordered_labels),):
            raise ManifestError("HEAD_SHAPE_MISMATCH")
        flat.update({f"{head}.{key}": value for key, value in values.items()})
    return _validate_flat_tensors(flat)


def convert_e4_heads(source, destination, expected_sha256, labels, hidden_size):
    state = restricted_e4_heads(source, expected_sha256, labels, hidden_size)
    return _write_heads(
        source,
        destination,
        expected_sha256,
        state,
        {
            "source_format": "nested_e4_plutchik_goemotions",
            "ordered_head_labels": labels,
            "hidden_size": hidden_size,
            "key_map": {
                f"{head}/{kind}": f"{head}.{kind}" for head in labels for kind in ("weight", "bias")
            },
            "computation_verified": False,
        },
    )


def _write_heads(source, destination, expected_sha256, converted, extra):
    import torch
    from safetensors.torch import load_file, save

    destination = Path(destination)
    report_path = destination.with_suffix(".conversion.json")
    if destination.suffix != ".safetensors" or destination.exists() or report_path.exists():
        raise ManifestError("CONVERSION_DESTINATION_MUST_BE_NEW")
    converted = {name: tensor.contiguous().clone() for name, tensor in converted.items()}
    with destination.open("xb") as stream:
        stream.write(save(converted))
    reloaded = load_file(destination, device="cpu")
    if set(reloaded) != set(converted) or any(
        not torch.equal(reloaded[k], v) for k, v in converted.items()
    ):
        raise ManifestError("HEAD_CONVERSION_VALUE_MISMATCH")
    report = {
        "schema": "echo-restricted-head-conversion-v1",
        "source_sha256": expected_sha256,
        "destination_sha256": sha256(destination),
        "method": "torch.load(weights_only=True,map_location=cpu); no added safe globals; safetensors",
        "tensor_keys": {name: list(t.shape) for name, t in converted.items()},
        "source_preserved": sha256(source) == expected_sha256,
        "tensor_values_preserved": True,
        "research_status": "provisional_nonfinal_not_clinically_validated",
        **extra,
    }
    if not report["source_preserved"]:
        raise ManifestError("SOURCE_CHANGED_DURING_CONVERSION")
    with report_path.open("x", encoding="utf8") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    return report


def convert_heads(source, destination, expected_sha256, key_map, expected_shapes):
    destination = Path(destination)
    report_path = destination.with_suffix(".conversion.json")
    if destination.suffix != ".safetensors" or destination.exists() or report_path.exists():
        raise ManifestError("CONVERSION_DESTINATION_MUST_BE_NEW")
    state = restricted_heads(source, expected_sha256)
    if (
        set(key_map) != set(state)
        or len(set(key_map.values())) != len(state)
        or set(key_map.values()) != set(expected_shapes)
    ):
        raise ManifestError("EXPLICIT_COMPLETE_HEAD_KEY_MAP_REQUIRED")
    converted = {key_map[name]: tensor.contiguous().clone() for name, tensor in state.items()}
    if any(
        tuple(tensor.shape) != tuple(expected_shapes[name]) for name, tensor in converted.items()
    ):
        raise ManifestError("HEAD_SHAPE_MISMATCH")
    return _write_heads(source, destination, expected_sha256, converted, {"key_map": key_map})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["inspect-heads", "convert-heads", "convert-e4-heads"])
    parser.add_argument("source", type=Path)
    parser.add_argument("--source-sha256", required=True)
    parser.add_argument("--destination", type=Path)
    parser.add_argument("--mapping", type=Path, help="Reviewed JSON key_map and expected_shapes")
    parser.add_argument("--e4-config", type=Path)
    parser.add_argument("--hidden-size", type=int)
    args = parser.parse_args()
    if args.command == "inspect-heads":
        state = restricted_heads(args.source, args.source_sha256)
        print(
            json.dumps(
                {
                    name: {"shape": list(t.shape), "dtype": str(t.dtype)}
                    for name, t in state.items()
                },
                indent=2,
            )
        )
    elif args.command == "convert-e4-heads":
        if not args.destination or not args.e4_config or not args.hidden_size:
            parser.error("convert-e4-heads requires --destination --e4-config --hidden-size")
        config = json.loads(args.e4_config.read_text(encoding="utf8"))
        labels = {"plutchik": config["plutchik_labels"], "goemotions": config["goemotions_labels"]}
        print(
            json.dumps(
                convert_e4_heads(
                    args.source, args.destination, args.source_sha256, labels, args.hidden_size
                ),
                indent=2,
            )
        )
    else:
        if not args.destination or not args.mapping:
            parser.error("convert-heads requires --destination and --mapping")
        mapping = json.loads(args.mapping.read_text(encoding="utf8"))
        print(
            json.dumps(
                convert_heads(
                    args.source,
                    args.destination,
                    args.source_sha256,
                    mapping["key_map"],
                    mapping["expected_shapes"],
                ),
                indent=2,
            )
        )


if __name__ == "__main__":
    main()
