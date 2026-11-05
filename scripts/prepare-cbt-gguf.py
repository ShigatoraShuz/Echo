"""Explicit offline CBT conversion. Does not change Echo's active inference configuration."""
from __future__ import annotations
import argparse
import ctypes
from contextlib import contextmanager
import gc
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
ADAPTER_SHA = "6bfe92fc0ba316997a18abcb7c79a1fda7cec608bce07baaa7719bfb47c7c04e"
CONFIG_SHA = "69ecc08861220cf86bc11d770c2914d3a350c12b9037097900b1fe0787c0efad"
ARTIFACT = "cbt-mixed-epochs-2-q4_k_m"


def digest(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024**2), b""):
            h.update(block)
    return h.hexdigest()


def atomic_json(path, data):
    temporary = path.with_name(path.name + f".{os.getpid()}.tmp")
    with temporary.open("w", encoding="utf-8") as output:
        json.dump(data, output, indent=2)
        output.flush()
        os.fsync(output.fileno())
    os.replace(temporary, path)


def inventory(directory):
    return [{"path": p.relative_to(directory).as_posix(), "bytes": p.stat().st_size,
             "sha256": digest(p)} for p in sorted(directory.rglob("*")) if p.is_file()]


def verify_files(directory, files):
    directory = directory.resolve()
    if not files:
        raise ValueError("Empty artifact inventory")
    seen = set()
    for entry in files:
        relative = entry["path"]
        path = (directory / relative).resolve()
        if path == directory or not path.is_relative_to(directory) or relative in seen:
            raise ValueError("Unsafe or duplicate inventory path")
        seen.add(relative)
        if not path.is_file() or path.stat().st_size != entry["bytes"] or digest(path) != entry["sha256"]:
            raise ValueError("Asset integrity failure: " + relative)


def verify_inputs(root):
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    files = [entry for entry in manifest["files"] if entry["path"].startswith(("buddy/base/", "buddy/adapter/"))]
    verify_files(root, files)
    by_path = {entry["path"]: entry for entry in files}
    required = ["buddy/adapter/adapter_config.json", "buddy/adapter/adapter_model.safetensors",
                "buddy/adapter/tokenizer.json", "buddy/adapter/tokenizer_config.json", "buddy/adapter/chat_template.jinja",
                "buddy/base/config.json", "buddy/base/model.safetensors.index.json"]
    if any(name not in by_path for name in required):
        raise ValueError("Required source is not inventoried")
    if digest(root / required[0]) != CONFIG_SHA or digest(root / required[1]) != ADAPTER_SHA:
        raise ValueError("Exact mixed_epochs_2 adapter identity differs")
    config = json.loads((root / "buddy/base/config.json").read_text(encoding="utf-8"))
    if config.get("architectures") != ["Qwen2ForCausalLM"] or config.get("model_type") != "qwen2":
        raise ValueError("Unexpected CBT base architecture")
    index = json.loads((root / "buddy/base/model.safetensors.index.json").read_text(encoding="utf-8"))
    shards = set(index["weight_map"].values())
    if not shards or any("buddy/base/" + name not in by_path or Path(name).name != name for name in shards):
        raise ValueError("Base shards are incomplete or unsafe")
    actual = {p.name for p in (root / "buddy/base").glob("*.safetensors")}
    if actual != shards:
        raise ValueError("Unexpected or missing base weight shards")
    payload = {"adapterSHA256": ADAPTER_SHA, "adapterConfigSHA256": CONFIG_SHA, "files": files}
    payload["identity"] = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    payload["baseBytes"] = sum(by_path["buddy/base/" + name]["bytes"] for name in shards)
    return payload


def available_ram():
    if os.name != "nt":
        return os.sysconf("SC_AVPHYS_PAGES") * os.sysconf("SC_PAGE_SIZE")
    class Memory(ctypes.Structure):
        _fields_ = [("length", ctypes.c_ulong), ("load", ctypes.c_ulong)] + [(name, ctypes.c_ulonglong) for name in
            ("totalPhysical", "availablePhysical", "totalPage", "availablePage", "totalVirtual", "availableVirtual", "availableExtended")]
    memory = Memory()
    memory.length = ctypes.sizeof(memory)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(memory)):
        raise OSError("Unable to measure physical memory")
    return memory.availablePhysical


def resource_check(root, base_bytes, ram=None, free=None):
    ram = available_ram() if ram is None else ram
    free = shutil.disk_usage(root).free if free is None else free
    # Preserve a CPU loading margin and room for merged + BF16 + Q4 + temporary output.
    required_ram = base_bytes + 6 * 1024**3
    required_disk = base_bytes * 3 + 4 * 1024**3
    if required_ram > 28_000_000_000:
        raise ValueError("Merge requires more than the configured 28 GB budget")
    if ram < required_ram:
        raise ValueError("Insufficient free RAM for CPU BF16 merge")
    if free < required_disk:
        raise ValueError("Insufficient staging disk capacity")
    return {"availableRAMBytes": ram, "requiredRAMBytes": required_ram,
            "freeDiskBytes": free, "requiredDiskBytes": required_disk}


def setup_module():
    spec = importlib.util.spec_from_file_location("echo_llama_setup", ROOT / "scripts/install-llama-runtime.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def merge_standard_lora_fp32(model):
    """Use PEFT safe merge with one FP32 base layer at a time, then store BF16.

    Promoting the base layer avoids rounding the delta to BF16 *before* addition.
    Full-model FP32 loading would violate this machine's memory budget.
    """
    import torch
    from peft.tuners.lora.layer import Linear
    layers = [module for module in model.modules() if isinstance(module, Linear)]
    if not layers:
        raise ValueError("No standard LoRA linear layers to merge")
    for module in layers:
        if module.merged or module.active_adapters != ["default"] or module.lora_variant:
            raise ValueError("Unsupported premerged/multiple/variant adapter")
        base = module.get_base_layer()
        if base.weight.dtype != torch.bfloat16:
            raise ValueError("Expected BF16 base weight")
        with torch.no_grad():
            base.weight.data = base.weight.data.float()
            try:
                module.merge(safe_merge=True, adapter_names=["default"])
            finally:
                base.weight.data = base.weight.data.to(torch.bfloat16)
    # PEFT unload retains the weights already merged above, without merging twice.
    merged = model.unload().eval()
    if any("lora_" in name for name, _ in merged.named_parameters()):
        raise ValueError("Unmerged adapter parameters remain")
    return merged, len(layers)


def merge(root, stage):
    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer
    torch.set_num_threads(min(8, os.cpu_count() or 1))
    base, adapter = root / "buddy/base", root / "buddy/adapter"
    tokenizer = AutoTokenizer.from_pretrained(adapter, local_files_only=True, trust_remote_code=False)
    if not tokenizer.chat_template:
        raise ValueError("Adapter chat template is required")
    messages = [{"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Hello, Buddy."}]
    ids = tokenizer.apply_chat_template(messages, tokenize=True, add_generation_prompt=True, return_tensors="pt")
    if not isinstance(ids, torch.Tensor):
        ids = ids["input_ids"]
    model = AutoModelForCausalLM.from_pretrained(base, local_files_only=True, trust_remote_code=False,
        dtype=torch.bfloat16, device_map={"": "cpu"}, low_cpu_mem_usage=True, attn_implementation="eager")
    model = PeftModel.from_pretrained(model, adapter, is_trainable=False, local_files_only=True).eval()
    with torch.inference_mode():
        before = model(input_ids=ids, use_cache=False).logits[:, -1].float().clone()
    model, merged_layers = merge_standard_lora_fp32(model)
    if any("lora_" in name for name, _ in model.named_parameters()):
        raise ValueError("Unmerged adapter parameters remain")
    with torch.inference_mode():
        after = model(input_ids=ids, use_cache=False).logits[:, -1].float()
    difference = (before - after).abs()
    validation = {"mergeMethod": "PEFT safe merge, FP32 layer addition, BF16 storage",
        "mergedLinearLayers": merged_layers, "maxAbsoluteLogitDifference": difference.max().item(),
        "meanAbsoluteLogitDifference": difference.mean().item(), "absoluteTolerance": 0.5,
        "rootMeanSquareDifference": difference.square().mean().sqrt().item(),
        "referenceRootMeanSquare": before.square().mean().sqrt().item(),
        "topTokenAgrees": before.argmax().item() == after.argmax().item(),
        "probe": "fixed benign final-token BF16 comparison; not a quality evaluation"}
    print(json.dumps({"stage": "merge_comparison", **validation}), flush=True)
    if not torch.isfinite(after).all() or difference.max().item() > 0.5:
        raise ValueError("High-precision merge logit comparison failed")
    output = stage / "merged"
    model.save_pretrained(output, safe_serialization=True, max_shard_size="4GB")
    tokenizer.save_pretrained(output)
    restored = AutoTokenizer.from_pretrained(output, local_files_only=True, trust_remote_code=False)
    probes = [messages, [{"role": "user", "content": "Kumusta? Can we take this step by step?"}]]
    for probe in probes:
        for tokenize in (True, False):
            if restored.apply_chat_template(probe, tokenize=tokenize, add_generation_prompt=True) != tokenizer.apply_chat_template(probe, tokenize=tokenize, add_generation_prompt=True):
                raise ValueError("Serialized tokenizer/template parity failed")
    validation["tokenizerTemplateParity"] = True
    del model, before, after, tokenizer, restored
    gc.collect()
    return validation


def run(command, env):
    subprocess.run([str(value) for value in command], check=True, env=env, timeout=3600,
                   stdout=sys.stdout, stderr=sys.stderr,
                   creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))


def check_gguf(path, source, template, quantized=False):
    sys.path.insert(0, str(source / "gguf-py"))
    from gguf import GGUFReader
    reader = GGUFReader(str(path))
    if reader.get_field("general.architecture").contents() != "qwen2":
        raise ValueError("GGUF architecture differs")
    if reader.get_field("tokenizer.chat_template").contents() != template:
        raise ValueError("GGUF chat template differs")
    if not reader.tensors:
        raise ValueError("GGUF contains no tensors")
    kinds = sorted({tensor.tensor_type.name for tensor in reader.tensors})
    if quantized and "Q4_K" not in kinds:
        raise ValueError("Quantized artifact contains no Q4_K tensors")
    result = {"tensorCount": len(reader.tensors), "tensorTypes": kinds}
    del reader
    gc.collect()
    return result


@contextmanager
def build_lease(root):
    path = root / "llama/artifacts/.cbt-conversion.lock"
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        raise ValueError("Conversion lease exists; confirm its owner has exited before manual recovery") from None
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            json.dump({"pid": os.getpid()}, output)
            output.flush()
            os.fsync(output.fileno())
        yield
    finally:
        path.unlink()


def build(root, inputs, lock, source, runtime, resources):
    target = root / "llama/artifacts" / ARTIFACT
    if (target / "manifest.json").exists():
        receipt = json.loads((target / "manifest.json").read_text(encoding="utf-8"))
        if receipt["sourceIdentity"] != inputs["identity"] or receipt["llamaCommit"] != lock["commit"]:
            raise ValueError("Existing artifact provenance differs")
        verify_files(target, receipt["files"])
        return target
    if target.exists():
        raise ValueError("Unverified target preserved for inspection")
    stage = target.with_name(target.name + ".staging")
    stage.mkdir(parents=True, exist_ok=True)
    receipt_path = stage / "merge-receipt.json"
    if receipt_path.exists():
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        if receipt["sourceIdentity"] != inputs["identity"]:
            raise ValueError("Staged merge identity differs")
        verify_files(stage / "merged", receipt["files"])
        validation = receipt["validation"]
    else:
        permitted = {"source-identity.json", "merge-progress.json", "merged", "stream-merge.json",
                     "original-probe.npy", "original-probe.json", "merged-probe.npy", "merged-probe.json"}
        if any(path.name not in permitted for path in stage.iterdir()):
            raise ValueError("Partial unverified staging preserved; inspect before retry")
        identity_file = stage / "source-identity.json"
        if identity_file.exists():
            if json.loads(identity_file.read_text(encoding="utf-8"))["identity"] != inputs["identity"]:
                raise ValueError("Staged source identity differs")
        else:
            if any(stage.iterdir()):
                raise ValueError("Partial unverified staging preserved; inspect before retry")
            atomic_json(identity_file, inputs)
        env = worker_environment()
        print(json.dumps({"stage": "merging_shards", "device": "cpu", "storage": "bfloat16"}), flush=True)
        run([sys.executable, Path(__file__), "--limited-worker", "--component", "merge"], env)
        validation = json.loads((stage / "stream-merge.json").read_text(encoding="utf-8"))
        for component in ("original", "merged"):
            print(json.dumps({"stage": "comparing_merge", "component": component}), flush=True)
            run([sys.executable, Path(__file__), "--limited-worker", "--component", component], env)
        import numpy as np
        before = np.load(stage / "original-probe.npy", allow_pickle=False)
        after = np.load(stage / "merged-probe.npy", allow_pickle=False)
        original_metadata = json.loads((stage / "original-probe.json").read_text(encoding="utf-8"))
        merged_metadata = json.loads((stage / "merged-probe.json").read_text(encoding="utf-8"))
        if original_metadata != merged_metadata or before.shape != after.shape:
            raise ValueError("Probe tokenizer/template or vocabulary differs")
        difference = np.abs(before - after)
        validation.update({"maxAbsoluteLogitDifference": float(difference.max()),
            "meanAbsoluteLogitDifference": float(difference.mean()), "absoluteTolerance": 0.5,
            "rootMeanSquareDifference": float(np.sqrt(np.mean(difference**2))),
            "referenceRootMeanSquare": float(np.sqrt(np.mean(before**2))),
            "topTokenAgrees": bool(before.argmax() == after.argmax()), "tokenizerTemplateParity": True,
            "probe": "fixed benign final-token FP32 compute with BF16 stored weights; not a quality evaluation"})
        print(json.dumps({"stage": "merge_comparison", **validation}), flush=True)
        if not np.isfinite(before).all() or not np.isfinite(after).all() or difference.max() > 0.5:
            raise ValueError("High-precision merge logit comparison failed")
        atomic_json(receipt_path, {"sourceIdentity": inputs["identity"], "validation": validation,
                                 "files": inventory(stage / "merged")})
    env = worker_environment()
    template = (stage / "merged/chat_template.jinja").read_text(encoding="utf-8")
    high = stage / "cbt-mixed-epochs-2-bf16.gguf"
    quant = stage / "cbt-mixed-epochs-2-q4_k_m.gguf"
    # Never treat an interrupted output as complete. The verified merge is reusable.
    print(json.dumps({"stage": "converting_bf16"}), flush=True)
    run([sys.executable, source / "convert_hf_to_gguf.py", stage / "merged", "--outtype", "bf16", "--outfile", high], env)
    high_validation = check_gguf(high, source, template)
    print(json.dumps({"stage": "quantizing_q4_k_m"}), flush=True)
    run([runtime / "bin/llama-quantize.exe", high, quant, "Q4_K_M", "8"], env)
    quant_validation = check_gguf(quant, source, template, True)
    if high_validation["tensorCount"] != quant_validation["tensorCount"]:
        raise ValueError("GGUF tensor coverage differs")
    import importlib.metadata
    versions = {name: importlib.metadata.version(name) for name in ("torch", "transformers", "peft", "safetensors")}
    atomic_json(stage / "manifest.json", {"schemaVersion": 1, "model": "mixed_epochs_2",
        "base": "SeaLLMs/SeaLLMs-v3-7B-Chat", "sourceIdentity": inputs["identity"],
        "adapterSHA256": ADAPTER_SHA, "adapterConfigSHA256": CONFIG_SHA, "llamaCommit": lock["commit"],
        "validation": validation, "bf16": high_validation, "q4KM": quant_validation, "dependencies": versions,
        "resourcesBeforeBuild": resources, "resourceLimits": {"memoryBytes": 28_000_000_000, "cpuPercent": 60},
        "files": inventory(stage), "activeInferenceChanged": False})
    os.replace(stage, target)
    return target


def worker_environment():
    env = {key: value for key, value in os.environ.items() if key.upper() in
           ("SYSTEMROOT", "WINDIR", "PATH", "TEMP", "TMP", "PATHEXT", "COMSPEC", "USERPROFILE", "USERNAME", "SYSTEMDRIVE", "LOCALAPPDATA", "ECHO_CONVERSION_JOB_NAME")}
    env.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_DATASETS_OFFLINE="1", CUDA_VISIBLE_DEVICES="-1",
               PYTHONDONTWRITEBYTECODE="1", PYTHONUTF8="1",
               TORCHINDUCTOR_CACHE_DIR=str(ROOT / "models/llama/cache/torch-inductor"))
    return env


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build", action="store_true", help="explicitly merge/convert offline; default only verifies inputs")
    parser.add_argument("--limited-worker", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--component", choices=("merge", "original", "merged"), help=argparse.SUPPRESS)
    args = parser.parse_args()
    from windows_resource_limits import Policy, assert_current_limits, run_limited
    if not args.limited_worker:
        command = [sys.executable, str(Path(__file__).resolve()), *sys.argv[1:], "--limited-worker"]
        raise SystemExit(run_limited(command))
    assert_current_limits(Policy())
    # Must precede ML imports. This process does not acquire the application's GPU.
    os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_DATASETS_OFFLINE="1", CUDA_VISIBLE_DEVICES="-1")
    sys.dont_write_bytecode = True
    root = ROOT / "models"
    if args.component:
        from cbt_shard_merge import merge_shards, probe
        stage = root / "llama/artifacts" / (ARTIFACT + ".staging")
        identity = json.loads((stage / "source-identity.json").read_text(encoding="utf-8"))["identity"]
        if args.component == "merge":
            validation = merge_shards(root, stage, identity)
            atomic_json(stage / "stream-merge.json", validation)
        else:
            probe(root, stage, args.component == "original")
        return
    print(json.dumps({"stage": "verifying_sources"}), flush=True)
    inputs = verify_inputs(root)
    resources = resource_check(root, inputs["baseBytes"])
    lock = json.loads((ROOT / "scripts/llama-runtime.lock.json").read_text(encoding="utf-8"))
    setup = setup_module()
    runtime = setup.install(root, lock)
    source = setup.install_source(root, lock)
    print(json.dumps({"stage": "verified", "adapterSHA256": ADAPTER_SHA, "sourceIdentity": inputs["identity"],
                      "resources": resources, "buildRequested": args.build}), flush=True)
    if args.build:
        with build_lease(root):
            artifact = build(root, inputs, lock, source, runtime, resources)
        print(json.dumps({"artifact": str(artifact), "activeInferenceChanged": False}), flush=True)


if __name__ == "__main__":
    main()
