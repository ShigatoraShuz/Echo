"""Local paths are operator configuration, never accepted from HTTP clients."""
import hashlib
import json
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent
ADAPTER_SHA = "6bfe92fc0ba316997a18abcb7c79a1fda7cec608bce07baaa7719bfb47c7c04e"
ADAPTER_CONFIG_SHA = "69ecc08861220cf86bc11d770c2914d3a350c12b9037097900b1fe0787c0efad"
VOICE_SHA = "3842d142fe4570197a059261467b806ccc36d2d35d4044255dc0d224be03a08f"
BUDDY_ENV_KEYS = ("ECHO_BUDDY_ENABLED", "BUDDY_NANO_ROOT", "BUDDY_CBT_PYTHON",
                  "BUDDY_NANO_PYTHON", "BUDDY_WHISPER_PYTHON", "BUDDY_WHISPER_DIR",
                  "BUDDY_CBT_ADAPTER")
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
