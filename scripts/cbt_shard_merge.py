"""Bounded-memory offline LoRA merge and FP32-compute validation probes."""
from __future__ import annotations
from contextlib import contextmanager
import gc
import hashlib
import json
import os
from pathlib import Path
import shutil


def tensor_hash(tensor):
    import torch
    return hashlib.sha256(memoryview(tensor.detach().contiguous().view(torch.uint8).numpy()).cast("B")).hexdigest()


def adapter_pairs(config, tensors):
    unsupported = ("use_dora", "use_rslora", "fan_in_fan_out", "lora_bias", "modules_to_save", "rank_pattern", "alpha_pattern",
        "layer_replication", "alora_invocation_tokens", "arrow_config", "use_bdlora", "kasa_config", "velora_config", "monteclora_config")
    if config.get("peft_type") != "LORA" or config.get("bias", "none") != "none" or any(config.get(k) for k in unsupported):
        raise ValueError("Only the selected plain LoRA configuration is supported")
    rank = config["r"]
    if not isinstance(rank, int) or rank <= 0:
        raise ValueError("Invalid adapter rank")
    pairs = {}
    for key, tensor in tensors.items():
        if not key.startswith("base_model.model."):
            raise ValueError("Unexpected adapter key")
        name = key[len("base_model.model."):]
        suffix = next((part for part in (".lora_A.weight", ".lora_B.weight") if name.endswith(part)), None)
        if suffix is None:
            raise ValueError("Unsupported adapter tensor")
        base = name[:-len(suffix)]
        if base.rsplit(".", 1)[-1] not in config["target_modules"]:
            raise ValueError("Adapter target is outside its configuration")
        pairs.setdefault(base + ".weight", {})[suffix[6]] = tensor
    if not pairs:
        raise ValueError("Empty adapter")
    for pair in pairs.values():
        if set(pair) != {"A", "B"} or pair["A"].ndim != 2 or pair["B"].ndim != 2 or pair["A"].shape[0] != rank or pair["B"].shape[1] != rank:
            raise ValueError("Incomplete or incompatible adapter pair")
    return pairs, float(config["lora_alpha"]) / rank


def merge_shards(root, stage, source_identity):
    import torch
    from safetensors import safe_open
    from safetensors.torch import load_file, save_file
    from importlib.util import spec_from_file_location, module_from_spec
    spec = spec_from_file_location("echo_conversion_helpers", Path(__file__).with_name("prepare-cbt-gguf.py"))
    helpers = module_from_spec(spec)
    spec.loader.exec_module(helpers)
    torch.set_num_threads(min(8, os.cpu_count() or 1))
    base, adapter = root / "buddy/base", root / "buddy/adapter"
    config = json.loads((adapter / "adapter_config.json").read_text(encoding="utf-8"))
    pairs, scale = adapter_pairs(config, load_file(adapter / "adapter_model.safetensors", device="cpu"))
    output = stage / "merged"
    output.mkdir(exist_ok=True)
    progress_file = stage / "merge-progress.json"
    progress = {"sourceIdentity": source_identity, "shards": {}}
    if progress_file.exists():
        progress = json.loads(progress_file.read_text(encoding="utf-8"))
        if progress["sourceIdentity"] != source_identity:
            raise ValueError("Partial merge source identity differs")
    index_file = base / "model.safetensors.index.json"
    index = json.loads(index_file.read_text(encoding="utf-8")) if index_file.exists() else None
    names = sorted(set(index["weight_map"].values())) if index else ["model.safetensors"]
    seen, tensor_count = set(), 0
    for number, name in enumerate(names, 1):
        if Path(name).name != name:
            raise ValueError("Unsafe shard name")
        receipt = progress["shards"].get(name)
        if receipt:
            if helpers.digest(base / name) != receipt["sourceSHA256"]:
                raise ValueError("Source shard changed after staging")
            helpers.verify_files(output, [receipt["file"]])
            seen.update(receipt["adaptedWeights"])
            tensor_count += receipt["tensorCount"]
            continue
        if (output / name).exists():
            raise ValueError("Unverified output shard preserved for review")
        values, hashes, adapted = {}, {}, []
        with safe_open(base / name, framework="pt", device="cpu") as source:
            for key in source.keys():
                value = source.get_tensor(key)
                if key in pairs:
                    pair = pairs[key]
                    delta = (pair["B"].float() @ pair["A"].float()) * scale
                    if delta.shape != value.shape or value.dtype != torch.bfloat16:
                        raise ValueError("Base/adapter shape or dtype mismatch")
                    merged = (value.float() + delta).to(value.dtype)
                    if not torch.isfinite(merged).all():
                        raise ValueError("Nonfinite merged tensor")
                    del delta
                    value = merged
                    adapted.append(key)
                hashes[key] = tensor_hash(value)
                values[key] = value
            temporary = output / (name + ".writing")
            save_file(values, temporary, metadata={"format": "pt"})
            with safe_open(temporary, framework="pt", device="cpu") as saved:
                if set(saved.keys()) != set(hashes):
                    raise ValueError("Saved tensor coverage differs")
                for key in saved.keys():
                    if tensor_hash(saved.get_tensor(key)) != hashes[key]:
                        raise ValueError("Saved tensor differs from computed merge")
            os.replace(temporary, output / name)
        progress["shards"][name] = {"sourceSHA256": helpers.digest(base / name), "tensorCount": len(hashes),
            "adaptedWeights": adapted, "file": {"path": name, "bytes": (output / name).stat().st_size,
            "sha256": helpers.digest(output / name)}}
        helpers.atomic_json(progress_file, progress)
        seen.update(adapted)
        tensor_count += len(hashes)
        del values, hashes, value
        gc.collect()
        print(json.dumps({"stage": "merged_shard", "completed": number, "total": len(names)}), flush=True)
    if seen != set(pairs):
        raise ValueError("Not all adapter tensors were applied")
    # Preserve model/tokenizer/config bytes; no external paths or tokenizer fallback.
    for name in ("config.json", "generation_config.json", "model.safetensors.index.json"):
        if (base / name).exists():
            shutil.copyfile(base / name, output / name)
    for name in ("tokenizer.json", "tokenizer_config.json", "chat_template.jinja"):
        if not (adapter / name).is_file():
            raise ValueError("Required adapter tokenizer asset absent")
        shutil.copyfile(adapter / name, output / name)
    for directory, output_name in ((base, "BASE_README.md"), (adapter, "ADAPTER_README.md")):
        if (directory / "README.md").is_file():
            shutil.copyfile(directory / "README.md", output / output_name)
    return {"mergeMethod": "sharded FP32 B@A addition, BF16 storage", "mergedLinearLayers": len(seen),
        "tensorCount": tensor_count, "savedTensorHashesVerified": True}


@contextmanager
def fp32_layer_compute(model):
    """FP32 arithmetic with only the executing module's weights promoted."""
    import torch
    handles, pending, forwards = [], {}, []
    def bounded_linear(module, inputs):
        # Avoid a full FP32 lm_head/MLP copy and allocator accumulation across layers.
        inputs = inputs.float()
        output = torch.empty((*inputs.shape[:-1], module.out_features), dtype=torch.float32, device=inputs.device)
        for start in range(0, module.out_features, 1024):
            stop = min(start + 1024, module.out_features)
            weight = module.weight[start:stop].float()
            bias = module.bias[start:stop].float() if module.bias is not None else None
            output[..., start:stop] = torch.nn.functional.linear(inputs, weight, bias)
        return output
    def before(module, inputs):
        originals = []
        pending[id(module)] = originals
        for parameter in module._parameters.values():
            if parameter is not None and parameter.is_floating_point() and parameter.dtype != torch.float32:
                originals.append((parameter, parameter.data))
                parameter.data = parameter.data.float()
    def after(module, inputs, result):
        for parameter, original in pending.pop(id(module), []):
            parameter.data = original
        return result
    try:
        for module in model.modules():
            if isinstance(module, torch.nn.Embedding):
                # Lookup has no arithmetic: casting its result is exact and avoids a full FP32 vocabulary copy.
                handles.append(module.register_forward_hook(lambda module, inputs, result: result.float()))
            elif isinstance(module, torch.nn.Linear) and module.weight.dtype != torch.float32:
                forwards.append((module, "forward" in module.__dict__, module.__dict__.get("forward")))
                module.forward = lambda inputs, current=module: bounded_linear(current, inputs)
            elif module._parameters:
                handles.append(module.register_forward_pre_hook(before))
                handles.append(module.register_forward_hook(after, always_call=True))
        yield
    finally:
        for handle in handles:
            handle.remove()
        for module, was_local, original in forwards:
            if was_local:
                module.forward = original
            else:
                del module.forward
        for originals in pending.values():
            for parameter, original in originals:
                parameter.data = original


def probe(root, stage, original):
    import numpy as np
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    torch.set_num_threads(min(8, os.cpu_count() or 1))
    adapter = root / "buddy/adapter"
    directory = root / "buddy/base" if original else stage / "merged"
    tokenizer = AutoTokenizer.from_pretrained(adapter if original else directory, local_files_only=True, trust_remote_code=False)
    model = AutoModelForCausalLM.from_pretrained(directory, local_files_only=True, trust_remote_code=False,
        dtype=torch.bfloat16, device_map={"": "cpu"}, low_cpu_mem_usage=True, attn_implementation="eager").eval()
    if original:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, adapter, is_trainable=False, local_files_only=True).eval()
    messages = [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": "Hello, Buddy."}]
    ids = tokenizer.apply_chat_template(messages, tokenize=True, add_generation_prompt=True, return_tensors="pt")
    if not isinstance(ids, torch.Tensor):
        ids = ids["input_ids"]
    with torch.inference_mode(), fp32_layer_compute(model):
        logits = model(input_ids=ids, use_cache=False).logits[:, -1].float().numpy()
    if not np.isfinite(logits).all():
        raise ValueError("Nonfinite validation logits")
    label = "original" if original else "merged"
    np.save(stage / (label + "-probe.npy"), logits)
    metadata = {"inputSHA256": hashlib.sha256(ids.numpy().tobytes()).hexdigest(),
        "templateSHA256": hashlib.sha256(tokenizer.chat_template.encode()).hexdigest()}
    (stage / (label + "-probe.json")).write_text(json.dumps(metadata), encoding="utf-8")
    print(json.dumps({"stage": "validated_probe", "model": label, "compute": "streamed FP32"}), flush=True)
