"""Random tiny tensors exercise discovery. These tests are not research inference evidence."""

import json
import os
import shutil
import subprocess
import sys

import pytest
from pydantic import ValidationError
from test_qwen_cbt_adapter import tiny_bundle

from app.core.config import Settings
from app.model.management import Manager, atomic_json, safe_tree
from app.model.manifest import ManifestError


def dropped(root, name="CBT_New"):
    directory = root / name
    directory.mkdir()
    tiny_bundle(directory)
    config = json.loads((directory / "config.json").read_text())
    config.update(eos_token_id=2, bos_token_id=1)
    atomic_json(directory / "config.json", config)
    from tokenizers import Tokenizer
    from tokenizers.models import WordLevel

    tokenizer = Tokenizer(
        WordLevel({"<unk>": 0, "<s>": 1, "</s>": 2, "fictional": 3}, unk_token="<unk>")
    )
    tokenizer.save(str(directory / "tokenizer.json"))
    atomic_json(
        directory / "tokenizer_config.json",
        {
            "tokenizer_class": "Qwen2Tokenizer",
            "eos_token": "</s>",
            "bos_token": "<s>",
            "unk_token": "<unk>",
            "chat_template": "{% for message in messages %}{{ message['content'] }}{% endfor %}",
        },
    )
    atomic_json(directory / "generation_config.json", {"eos_token_id": [2]})
    return directory


@pytest.fixture
def stopped_ports(monkeypatch):
    class Socket:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            pass

        def settimeout(self, *_):
            pass

        def connect_ex(self, *_):
            return 1

    monkeypatch.setattr("app.model.management.socket.socket", Socket)


def test_drop_import_activate_and_rollback_keep_originals(tmp_path, stopped_ports):
    manager = Manager(tmp_path)
    first = dropped(tmp_path, "CBT_First")
    second = dropped(tmp_path, "CBT_Second")
    rows = manager.scan(import_new=True)
    assert all(row["status"] == "engineering_only" for row in rows)
    originals = {p: p.read_bytes() for directory in (first, second) for p in directory.iterdir()}
    a = manager.activate("cbt", "CBT_First")
    b = manager.activate("cbt", "CBT_Second")
    assert a["tasks"]["cbt"] != b["tasks"]["cbt"]
    assert manager.activate(None, rollback=True)["tasks"] == a["tasks"]
    assert all(p.read_bytes() == data for p, data in originals.items())


@pytest.mark.parametrize(
    "fault,reason",
    [
        ("tokenizer", "TOKENIZER_MISSING"),
        ("weights", "WEIGHTS_MISSING"),
        ("architecture", "UNSUPPORTED_ARCHITECTURE"),
        ("shards", "INCOMPLETE_WEIGHT_SHARDS"),
        ("ambiguous", "AMBIGUOUS_TASK"),
        ("head", "UNSUPPORTED_ARCHITECTURE"),
        ("calibration", "VERIFIED_CALIBRATION"),
        ("unsafe", "INVALID_ARTIFACT_PATH"),
    ],
)
def test_incompatible_dropped_exports_never_gain_manifest(tmp_path, fault, reason):
    directory = dropped(tmp_path)
    if fault == "tokenizer":
        (directory / "tokenizer.json").unlink()
    if fault == "weights":
        (directory / "model.safetensors").unlink()
    if fault in ("architecture", "head", "ambiguous", "calibration"):
        config = json.loads((directory / "config.json").read_text())
        config["architectures"] = (
            ["UnsupportedCustomHead"]
            if fault in ("architecture", "head")
            else ["RobertaForSequenceClassification"]
        )
        atomic_json(directory / "config.json", config)
        if fault == "calibration":
            atomic_json(
                directory / "echo-export.json",
                {
                    "task": "distress",
                    "max_tokens": 128,
                    "normalization": "identity",
                    "semantics": "softmax",
                    "source": "fictional unit test export",
                    "calibration": "unverified",
                },
            )
    if fault in ("shards", "unsafe"):
        (directory / "model.safetensors").unlink()
        atomic_json(
            directory / "model.safetensors.index.json",
            {
                "weight_map": {
                    "missing": "../outside.safetensors"
                    if fault == "unsafe"
                    else "model-00001.safetensors"
                }
            },
        )
        if fault == "unsafe":
            # Direct confinement rejects before a shard can be opened.
            from app.model.manifest import confined_file

            with pytest.raises(ManifestError, match=reason):
                confined_file(directory, "../outside.safetensors")
            return
    row = Manager(tmp_path).scan(import_new=True)[0]
    assert row["status"] == "blocked" and reason in row["reason"]
    assert not (directory / "manifest.json").exists()


def test_empty_and_lora_export_requirements_are_explicit(tmp_path):
    (tmp_path / "Emotion_Final").mkdir()
    adapter = tmp_path / "PHQ_Adapter"
    adapter.mkdir()
    atomic_json(adapter / "adapter_config.json", {"base_model_name_or_path": "wrong-base"})
    rows = Manager(tmp_path).scan(import_new=True)
    assert {r["reason"] for r in rows} == {
        "EMPTY_FOLDER",
        "EXACT_REVIEWED_LORA_BASE_AND_EXPORT_CONTRACT_REQUIRED",
    }


@pytest.mark.parametrize(
    "fault,reason",
    [
        ("adapter", "EXACT_REVIEWED_LORA_BASE"),
        ("extra-head", "UNSUPPORTED_CUSTOM_HEAD_SPEC"),
        ("context", "QWEN_ENGINEERING_INPUT_LIMIT"),
        ("labels", "LABEL_ORDER_MISMATCH"),
    ],
)
def test_extra_artifacts_and_inconsistent_export_metadata_are_not_ignored(tmp_path, fault, reason):
    directory = dropped(tmp_path)
    if fault == "adapter":
        atomic_json(
            directory / "adapter_config.json", {"base_model_name_or_path": "unverified-base"}
        )
    elif fault == "extra-head":
        (directory / "heads.safetensors").write_bytes(b"untrusted test header; never loaded")
    elif fault == "context":
        atomic_json(directory / "echo-export.json", {"task": "cbt", "max_tokens": 8192})
    else:
        config = json.loads((directory / "config.json").read_text())
        config.update(
            architectures=["RobertaForSequenceClassification"],
            id2label={str(i): label for i, label in enumerate("abcde")},
            label2id={"mismatched": 0},
        )
        atomic_json(directory / "config.json", config)
        atomic_json(
            directory / "echo-export.json",
            {
                "task": "distress",
                "max_tokens": 128,
                "normalization": "identity",
                "semantics": "softmax",
                "source": "Fictional test metadata only",
            },
        )
    item = Manager(tmp_path).scan(import_new=True)[0]
    assert item["status"] == "blocked" and reason in item["reason"]
    assert not (directory / "manifest.json").exists()


def test_duplicate_identity_is_not_resolved_by_directory_order(tmp_path, stopped_ports):
    directory = dropped(tmp_path)
    manager = Manager(tmp_path)
    manager.scan(import_new=True)
    shutil.copytree(directory, tmp_path / "Duplicate")
    rows = manager.scan(fresh=True)
    assert all(r["reason"] == "DUPLICATE_MODEL_VERSION" for r in rows)
    with pytest.raises(ManifestError):
        manager.activate("cbt", "CBT_New")
    assert manager.selection()["tasks"] == {}


def test_hash_mismatch_cannot_activate_and_selection_is_preserved(tmp_path, stopped_ports):
    directory = dropped(tmp_path)
    manager = Manager(tmp_path)
    manager.scan(import_new=True)
    manager.activate("cbt", "CBT_New")
    before = manager.active_path.read_bytes()
    with (directory / "model.safetensors").open("ab") as stream:
        stream.write(b"corruption")
    with pytest.raises(ManifestError):
        manager.activate("cbt", "CBT_New")
    assert manager.active_path.read_bytes() == before


def test_catalog_hash_cache_is_not_used_for_fresh_integrity(tmp_path):
    path = tmp_path / "weights.safetensors"
    path.write_bytes(b"a" * 1_100_000)
    manager = Manager(tmp_path)
    original = manager.digest(path)
    assert manager.digest(path) == original and manager.cache_hits == 1
    previous = path.stat()
    path.write_bytes(b"b" * 1_100_000)
    os.utime(path, ns=(previous.st_atime_ns, previous.st_mtime_ns))
    assert manager.digest(path, fresh=True) != original


def test_excluded_directories_are_not_discovered(tmp_path):
    for name in (
        ".archives",
        ".engineering",
        ".sources",
        "temp-conversion",
        "new.partial",
        "incomplete-extraction",
    ):
        directory = tmp_path / name
        directory.mkdir()
        atomic_json(directory / "config.json", {"architectures": ["Unsafe"]})
    assert list(safe_tree(tmp_path)) == [(tmp_path, [])]
    assert Manager(tmp_path).scan(import_new=True) == []


@pytest.mark.skipif(sys.platform != "win32", reason="Windows NTFS junction regression")
def test_windows_junction_cannot_import_external_checkpoint(tmp_path):
    outside = tmp_path.parent / (tmp_path.name + "_outside")
    outside.mkdir()
    atomic_json(outside / "config.json", {"architectures": ["UnsafeExternalHead"]})
    junction = tmp_path / "External_Checkpoint"
    subprocess.run(
        ["cmd.exe", "/d", "/c", "mklink", "/J", str(junction), str(outside)],
        check=True,
        capture_output=True,
    )
    assert junction.is_junction()
    assert Manager(tmp_path).scan(import_new=True) == []


def test_stale_activation_lock_cannot_overwrite_selection(tmp_path, stopped_ports):
    manager = Manager(tmp_path)
    manager.selection()
    before = manager.active_path.read_bytes()
    (manager.state / "activation.lock").write_text("operator-review-required")
    with pytest.raises(ManifestError, match="LOCK_REVIEW"):
        manager.activate("cbt", "missing")
    assert manager.active_path.read_bytes() == before


def test_invalid_selection_does_not_write_new_configuration(tmp_path, stopped_ports):
    manager = Manager(tmp_path)
    manager.selection()
    before = manager.active_path.read_bytes()
    with pytest.raises(ManifestError):
        manager.activate("cbt", "missing-checkpoint")
    assert manager.active_path.read_bytes() == before


@pytest.mark.parametrize(
    "changes",
    [{"app_env": "production"}, {"echo_execution_mode": "synthetic"}, {"ai_service_token": ""}],
)
def test_local_research_cannot_enable_production_or_unauthenticated_inference(changes):
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            **(
                {
                    "app_env": "development",
                    "echo_local_research": True,
                    "ai_service_token": "fictional-private-token-32-characters",
                }
                | changes
            ),
        )
