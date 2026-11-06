"""Local paths are operator configuration, never accepted from HTTP clients."""
import hashlib
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ADAPTER_SHA = "6bfe92fc0ba316997a18abcb7c79a1fda7cec608bce07baaa7719bfb47c7c04e"
ADAPTER_CONFIG_SHA = "69ecc08861220cf86bc11d770c2914d3a350c12b9037097900b1fe0787c0efad"
VOICE_SHA = "3842d142fe4570197a059261467b806ccc36d2d35d4044255dc0d224be03a08f"
BUDDY_ENV_KEYS = ("ECHO_SHARED_SEALLMS_VALIDATE", "ECHO_BUDDY_ENABLED", "BUDDY_NANO_ROOT", "BUDDY_CBT_PYTHON",
                  "BUDDY_NANO_PYTHON", "BUDDY_WHISPER_PYTHON", "BUDDY_WHISPER_DIR",
                  "BUDDY_CBT_ADAPTER", "BUDDY_MOSS_NATIVE_ROOT", "BUDDY_MOSS_PYTHON", "ECHO_MOSS_NATIVE_VALIDATE")
DEFAULT_ADAPTER = str(HERE.parents[2] / "models/buddy/adapter")

def enabled():
    return os.environ.get("ECHO_BUDDY_ENABLED") == "true"

def paths():
    parent = HERE.parents[2].parent
    root = Path(os.environ.get("BUDDY_NANO_ROOT", str(HERE.parents[2] / "models/buddy"))).resolve()
    return {
        "root": root,
        "adapter": Path(os.environ.get("BUDDY_CBT_ADAPTER", DEFAULT_ADAPTER)).resolve(),
        "cbt": Path(os.environ.get("BUDDY_CBT_PYTHON", "C:/Users/tolen/miniconda3/envs/Thesis2_VENV/python.exe")),
        "moss": Path(os.environ.get("BUDDY_MOSS_PYTHON", sys.executable)),
        "nano": Path(os.environ.get("BUDDY_NANO_PYTHON", str(parent / "TTS_INFERENCE_NANO_PRELOAD/.venv-nano/Scripts/python.exe"))),
        "whisper": Path(os.environ.get("BUDDY_WHISPER_PYTHON", str(parent / "speech-venv/Scripts/python.exe"))),
        "whisper_model": Path(os.environ.get("BUDDY_WHISPER_DIR", str(HERE.parents[2] / "models/voice/whisper"))),
    }

def digest(path):
    value = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()

def verify_adapter():
    adapter = paths()["adapter"]
    if digest(adapter / "adapter_model.safetensors") != ADAPTER_SHA or digest(adapter / "adapter_config.json") != ADAPTER_CONFIG_SHA:
        raise ValueError("BUDDY_ADAPTER_IDENTITY_FAILED")
    config = json.loads((adapter / "adapter_config.json").read_text("utf-8"))
    declared = Path(config["base_model_name_or_path"])
    base = HERE.parents[2] / "models/buddy/base"
    if declared.name != "SeaLLMs-v3-7B-Chat":raise ValueError("BUDDY_BASE_IDENTITY_FAILED")
    if not base.is_dir():
        raise ValueError("BUDDY_BASE_IDENTITY_FAILED")
    return base, adapter

def verify_nano():
    root = paths()["root"]
    manifest = json.loads((HERE / "assets.lock.json").read_text("utf-8"))
    from app.buddy.checkpoints import validate_checkpoint
    for name in ("nano", "codec"):
        validate_checkpoint(root / "models" / name)
    for name, expected in manifest["files"].items():
        target = (root / name.replace("\\", "/")).resolve()
        if not target.is_relative_to(root) or digest(target) != expected:
            raise ValueError("BUDDY_NANO_INTEGRITY_FAILED")
    if digest(root / "voices/buddy/sample.wav") != VOICE_SHA:
        raise ValueError("BUDDY_VOICE_IDENTITY_FAILED")
    metadata = json.loads((root / "voices/buddy/metadata.json").read_text("utf-8"))
    if metadata.get("sha256") != VOICE_SHA or metadata.get("version") != 1:
        raise ValueError("BUDDY_VOICE_METADATA_FAILED")
    sources=json.loads((HERE/'nano-source.lock.json').read_text())
    for name,expected in sources.items():
        if digest(HERE/'nano_vendor'/name)!=expected:raise ValueError('BUDDY_NANO_SOURCE_INTEGRITY_FAILED')
    return root


def verify_policy():
    """Validate the adopted V3 policy instead of obsolete Buddy vendor code."""
    inventory = json.loads((HERE / "v3-source.lock.json").read_text("utf-8"))
    if inventory.get("policy") != "echo_cbt_mixed_standalone_complete_steps_v3_20261101" or not inventory.get("files"):
        raise ValueError("BUDDY_POLICY_INTEGRITY_FAILED")
    root = (HERE / "v3").resolve()
    for name, expected in inventory["files"].items():
        file = (root / name).resolve()
        if not file.is_relative_to(root) or digest(file) != expected:
            raise ValueError("BUDDY_POLICY_INTEGRITY_FAILED")


def verify_cbt_gguf():
    """Pinned application artifacts only. No implicit download or native fallback."""
    root = HERE.parents[2] / "models"
    lock = json.loads((HERE / "cbt-gguf.lock.json").read_text(encoding="utf-8"))
    artifact = (root / lock["artifact"]).resolve()
    if not artifact.is_relative_to(root.resolve()):
        raise ValueError("BUDDY_CBT_GGUF_IDENTITY_FAILED")
    manifest = json.loads((artifact / "manifest.json").read_text(encoding="utf-8"))
    expected = {"model": "mixed_epochs_2", "base": "SeaLLMs/SeaLLMs-v3-7B-Chat",
        "adapterSHA256": ADAPTER_SHA, "adapterConfigSHA256": ADAPTER_CONFIG_SHA,
        "sourceIdentity": lock["sourceIdentity"], "llamaCommit": lock["llamaCommit"]}
    if any(manifest.get(key) != value for key, value in expected.items()):
        raise ValueError("BUDDY_CBT_GGUF_IDENTITY_FAILED")
    source = json.loads((artifact / "source-identity.json").read_text(encoding="utf-8"))
    body = {key: value for key, value in source.items() if key not in ("identity", "baseBytes")}
    if source.get("identity") != lock["sourceIdentity"] or hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest() != lock["sourceIdentity"]:
        raise ValueError("BUDDY_CBT_GGUF_IDENTITY_FAILED")
    token_files = set()
    for entry in source["files"]:
        if not entry["path"].startswith("buddy/adapter/"):
            continue
        asset = (root / entry["path"]).resolve()
        if not asset.is_relative_to(root.resolve()) or asset.stat().st_size != entry["bytes"] or digest(asset) != entry["sha256"]:
            raise ValueError("BUDDY_CBT_TOKENIZER_INTEGRITY_FAILED")
        token_files.add(entry["path"])
    if not {"buddy/adapter/tokenizer.json", "buddy/adapter/tokenizer_config.json", "buddy/adapter/chat_template.jinja"}.issubset(token_files):
        raise ValueError("BUDDY_CBT_TOKENIZER_ASSET_MISSING")
    model = lock["model"]
    file = (artifact / model["path"]).resolve()
    if not file.is_relative_to(artifact) or file.stat().st_size != model["bytes"] or digest(file) != model["sha256"]:
        raise ValueError("BUDDY_CBT_GGUF_INTEGRITY_FAILED")
    runtime_lock = json.loads((HERE.parents[2] / "scripts/llama-runtime.lock.json").read_text(encoding="utf-8"))
    if runtime_lock["commit"] != lock["llamaCommit"]:
        raise ValueError("BUDDY_CBT_LLAMA_IDENTITY_FAILED")
    runtime = root / "llama/runtime" / runtime_lock["tag"]
    installed = json.loads((runtime / "manifest.json").read_text(encoding="utf-8"))
    canonical = {**installed, "files": sorted(installed["files"], key=lambda entry: entry["path"])}
    if hashlib.sha256(json.dumps(canonical, sort_keys=True).encode()).hexdigest() != lock["runtimeInventorySHA256"]:
        raise ValueError("BUDDY_CBT_LLAMA_INTEGRITY_FAILED")
    if installed.get("commit") != lock["llamaCommit"] or installed.get("assets") != runtime_lock["assets"]:
        raise ValueError("BUDDY_CBT_LLAMA_INTEGRITY_FAILED")
    required = {"llama-server.exe", "llama.dll", "ggml.dll", "ggml-base.dll", "ggml-cuda.dll"}
    seen = set()
    for entry in installed["files"]:
        file_path = (runtime / entry["path"]).resolve()
        if not file_path.is_relative_to(runtime.resolve()):
            raise ValueError("BUDDY_CBT_LLAMA_INTEGRITY_FAILED")
        if file_path.stat().st_size != entry["bytes"] or digest(file_path) != entry["sha256"]:
            raise ValueError("BUDDY_CBT_LLAMA_INTEGRITY_FAILED")
        seen.add(file_path.name)
    if not required.issubset(seen) or not any(name.startswith("ggml-cpu-") and name.endswith(".dll") for name in seen):
        raise ValueError("BUDDY_CBT_LLAMA_ASSET_MISSING")
    return file, runtime / "bin/llama-server.exe", lock
