import asyncio
import hashlib
import json
import shutil
import time
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.routes.pipeline import router
from app.core.config import Settings, get_settings
from app.model.adapters import HeavyweightRuntime
from app.model.cli import fixture_manifest
from app.model.manifest import ManifestError, ModelManifest, confined_file, read_manifest
from app.model.registry import ModelRegistry
from app.model.results import PHQ8_ITEMS, Phq8Items


@pytest.fixture(autouse=True)
def isolated_internal_token(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_TOKEN", "test-internal-token")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def settings(root, **kwargs):
    return Settings(
        _env_file=None,
        app_env="test",
        echo_models_dir=root,
        echo_execution_mode="synthetic",
        **kwargs,
    )


def install(root, tasks=("peak", "distress", "phq8", "cbt")):
    active = {}
    for task in tasks:
        folder = root / task
        folder.mkdir(parents=True)
        manifest = fixture_manifest(task)
        (folder / "manifest.json").write_text(json.dumps(manifest))
        active[task] = f"{manifest['model_id']}@{manifest['version']}"
    return active


@pytest.mark.parametrize("value", [-1, 4, True, "2", 1.2])
def test_phq8_rejects_invalid_items(value):
    with pytest.raises(ValidationError):
        Phq8Items.model_validate(dict.fromkeys(PHQ8_ITEMS, value))


def test_unknown_phq8_items_do_not_become_zero_or_full_total():
    items = dict.fromkeys(PHQ8_ITEMS, None)
    items.update(anhedonia=2, fatigue=1)
    result = Phq8Items.model_validate(items).result()
    assert result["scored_symptom_count"] == 2
    assert result["subtotal"] == 3 and result["total"] is None
    assert result["complete"] is False and result["items"]["sleep"] is None
    assert "severity" not in result


def test_complete_total_requires_all_eight_items():
    result = Phq8Items.model_validate(dict.fromkeys(PHQ8_ITEMS, 2)).result()
    assert result["complete"] is True and result["total"] == 16


def test_actual_cpu_runtime_rejects_cuda_generation_before_loading_weights():
    torch = pytest.importorskip("torch")
    pytest.importorskip("peft")
    if torch.cuda.is_available():
        pytest.skip("This negative check requires a CPU-only runtime")
    runtime = HeavyweightRuntime()
    with pytest.raises(ManifestError, match="CUDA_UNAVAILABLE"):
        runtime.generate(None, None, None, None, "Fictional", [], 16, 1)
    assert runtime.model is None and runtime.loads == 0


@pytest.mark.parametrize(
    "change",
    [
        {
            "architecture": "Qwen2ForCausalLM",
            "export_format": "hf_safetensors",
            "family": "roberta",
        },
        {"labels": ["a", "b", "c", "d"]},
        {"labels": ["a"] * 5},
        {"output_schema": "unknown"},
        {"task": "cbt", "family": "sea_lion"},
        {"task": "phq8", "family": "seallms"},
        {"task": "cbt", "family": "seallms", "export_format": "hf_safetensors"},
    ],
)
def test_incompatible_architectures_and_metadata_rejected(change):
    value = fixture_manifest("peak") | change
    with pytest.raises(ValidationError):
        ModelManifest.model_validate(value)


def test_distress_requires_exact_five_labels():
    for labels in (["a"] * 5, ["a", "b", "c", "d"], ["a", "b", "c", "d", "e", "f"]):
        with pytest.raises(ValidationError):
            ModelManifest.model_validate(fixture_manifest("distress") | {"labels": labels})


@pytest.mark.parametrize("name", ["../secret", "C:/secret", "/secret", "..\\secret"])
def test_manifest_paths_confined(tmp_path, name):
    with pytest.raises(ManifestError):
        confined_file(tmp_path, name)


def test_synthetic_mode_is_test_only(tmp_path):
    for env in ("development", "production"):
        with pytest.raises(ValidationError):
            Settings(
                _env_file=None,
                app_env=env,
                ai_service_token="x" * 32,
                echo_execution_mode="synthetic",
            )
    active = install(tmp_path)
    path = tmp_path / "peak" / "manifest.json"
    with pytest.raises(ManifestError, match="SYNTHETIC_ARTIFACT_REFUSED"):
        read_manifest(path)
    assert active


def test_missing_models_and_face_return_unavailable(tmp_path):
    runtime = ModelRegistry(settings(tmp_path / "missing"))
    try:
        stages = asyncio.run(_stages(runtime))
        assert all(s["status"] == "unavailable" and s["result"] is None for s in stages.values())
    finally:
        runtime.close()


async def _stages(runtime):
    return {
        task: await runtime.stage(task, "Fictional reflection.")
        for task in ("peak", "distress", "phq8", "cbt", "face")
    }


def test_independent_partial_results_and_shared_cbt_adapter(tmp_path):
    active = install(tmp_path, ("peak", "distress", "phq8"))
    runtime = ModelRegistry(settings(tmp_path, echo_active_models=active))
    try:
        stages = asyncio.run(_stages(runtime))
        assert stages["peak"]["status"] == stages["distress"]["status"] == "completed"
        assert stages["phq8"]["result"]["total"] is None
        assert stages["cbt"]["status"] == stages["face"]["status"] == "unavailable"
        assert runtime.heavy.loads == 0
    finally:
        runtime.close()


def test_version_mismatch_and_disabled_model(tmp_path):
    active = install(tmp_path, ("peak",))
    runtime = ModelRegistry(
        settings(tmp_path, echo_active_models={"peak": active["peak"] + "wrong"})
    )
    try:
        assert (
            asyncio.run(runtime.stage("peak", "Fictional"))["errorCode"]
            == "MODEL_MISSING_OR_INVALID"
        )
    finally:
        runtime.close()


def test_timeout_queue_bound_and_no_overlapping_native_generation(tmp_path):
    runtime = ModelRegistry(settings(tmp_path, echo_stage_timeout_seconds=1, echo_queue_capacity=1))

    def slow(*_):
        time.sleep(1.1)
        raise ManifestError("CUDA_UNAVAILABLE")

    runtime.infer = slow

    async def run():
        first = asyncio.create_task(runtime.stage("cbt", "fictional"))
        await asyncio.sleep(0.02)
        second = await runtime.stage("cbt", "fictional")
        assert second["errorCode"] == "INFERENCE_QUEUE_FULL"
        assert (await first)["errorCode"] == "MODEL_TIMEOUT"
        assert runtime.admitted == 1  # Native task retains its slot after HTTP timeout.
        await asyncio.sleep(0.2)
        assert runtime.admitted == 0

    try:
        asyncio.run(run())
    finally:
        runtime.close()


@pytest.mark.parametrize(
    "error,code",
    [
        (MemoryError("out of memory"), "MODEL_OUT_OF_MEMORY"),
        (ManifestError("CUDA_UNAVAILABLE"), "CUDA_UNAVAILABLE"),
    ],
)
def test_resource_failures_are_honest_and_do_not_leak_native_details(tmp_path, error, code):
    runtime = ModelRegistry(settings(tmp_path))

    def fail(*_):
        raise error

    runtime.infer = fail
    try:
        stage = asyncio.run(runtime.stage("cbt", "fictional"))
        assert stage["errorCode"] == code and stage["result"] is None
    finally:
        runtime.close()


def test_internal_routes_auth_partial_success_and_buddy_unavailable(tmp_path):
    runtime = ModelRegistry(settings(tmp_path, echo_active_models=install(tmp_path, ("peak",))))
    app = FastAPI()
    app.state.pipeline_registry = runtime
    app.include_router(router)
    try:
        with TestClient(app) as client:
            assert client.post("/engineering/v2/analyze", json={"text": "fictional"}).status_code == 401
            headers = {"Authorization": "Bearer test-internal-token"}
            response = client.post("/engineering/v2/analyze", json={"text": "fictional"}, headers=headers)
            assert response.status_code == 200
            assert response.json()["overallStatus"] == "partial"
            assert response.json()["isSimulated"] is True
            assert (
                client.post("/engineering/v2/generate", json={"text": "fictional"}, headers=headers).status_code
                == 503
            )
            assert (
                client.post(
                    "/engineering/v2/analyze", json={"text": "I want to die"}, headers=headers
                ).status_code
                == 409
            )
    finally:
        runtime.close()


def test_real_roberta_loader_tiny_engineering_artifact():
    root = Path(__file__).resolve().parents[2] / "backend/models/.engineering/tiny-v1"
    if not root.exists():
        pytest.skip("Optional tiny random-weight artifact not installed")
    config = settings(
        root,
        echo_active_models={"peak": "echo-random-roberta-engineering@tiny-v1"},
        echo_stage_timeout_seconds=120,
    )
    runtime = ModelRegistry(config)
    try:
        output = asyncio.run(
            runtime.stage("peak", "Fictional student reflects on a small kind action.")
        )
        assert output["status"] == "completed", output
        assert len(output["result"]["topFive"]) == 5
        assert output["executionMode"] == "synthetic"
        adapter = runtime.adapters[("echo-random-roberta-engineering", "tiny-v1")]
        assert asyncio.run(runtime.stage("peak", "Fictional kind action"))["status"] == "completed"
        assert runtime.adapters[("echo-random-roberta-engineering", "tiny-v1")] is adapter
    finally:
        runtime.close()


def test_random_weight_hf_export_cannot_be_enabled_as_a_research_checkpoint():
    root = Path(__file__).resolve().parents[2] / "backend/models/.engineering/tiny-v1"
    if not root.exists():
        pytest.skip("Optional tiny random-weight artifact not installed")
    with pytest.raises(ManifestError, match="SYNTHETIC_ARTIFACT_REFUSED"):
        read_manifest(root / "manifest.json", synthetic=False)


def test_distress_roberta_executes_real_cpu_adapter_with_five_fixture_labels(tmp_path):
    source = Path(__file__).resolve().parents[2] / "backend/models/.engineering/tiny-v1"
    if not source.exists():
        pytest.skip("Optional tiny random-weight artifact not installed")
    manifest = json.loads((source / "manifest.json").read_text())
    for name in manifest["files"] + manifest["tokenizer_files"]:
        shutil.copy2(source / name, tmp_path / name)
    manifest.update(
        model_id="echo-random-distress-engineering",
        task="distress",
        output_schema="echo-distress-v1",
    )
    (tmp_path / "manifest.json").write_text(json.dumps(manifest))
    runtime = ModelRegistry(
        settings(
            tmp_path,
            echo_active_models={"distress": "echo-random-distress-engineering@tiny-v1"},
            echo_stage_timeout_seconds=120,
        )
    )
    try:
        result = asyncio.run(runtime.stage("distress", "Fictional engineering reflection."))
        assert result["status"] == "completed", result
        assert len(result["result"]["scores"]) == 5
        assert result["result"]["supportFlags"] is None
        assert result["result"]["semantics"] == "softmax"
        assert result["executionMode"] == "synthetic"
    finally:
        runtime.close()


def test_incomplete_real_weights_never_become_random_initialized_predictions(tmp_path):
    source = Path(__file__).resolve().parents[2] / "backend/models/.engineering/tiny-v1"
    if not source.exists():
        pytest.skip("Optional tiny random-weight artifact not installed")
    import torch
    from safetensors.torch import save_file

    manifest = json.loads((source / "manifest.json").read_text())
    for name in manifest["files"] + manifest["tokenizer_files"]:
        shutil.copy2(source / name, tmp_path / name)
    save_file(
        {"classifier.dense.weight": torch.zeros(16, 16)},
        tmp_path / "model.safetensors",
        metadata={"format": "pt"},
    )
    manifest["sha256"]["model.safetensors"] = hashlib.sha256(
        (tmp_path / "model.safetensors").read_bytes()
    ).hexdigest()
    (tmp_path / "manifest.json").write_text(json.dumps(manifest))
    runtime = ModelRegistry(
        settings(
            tmp_path,
            echo_active_models={"peak": "echo-random-roberta-engineering@tiny-v1"},
            echo_stage_timeout_seconds=120,
        )
    )
    try:
        result = asyncio.run(runtime.stage("peak", "Fictional engineering reflection."))
        assert result["result"] is None
        assert result["errorCode"] == "CHECKPOINT_PARAMETERS_MISSING_OR_MISMATCHED"
    finally:
        runtime.close()


def real_export(root, task="peak"):
    root.mkdir(parents=True, exist_ok=True)
    manifest = fixture_manifest(task)
    manifest["artifact_kind"] = "research_checkpoint"
    manifest["frameworks"] = {"torch": ">=2.6,<3", "transformers": ">=4.50,<5"}
    manifest.update(
        family="roberta",
        architecture="RobertaForSequenceClassification",
        export_format="hf_safetensors",
        files=["config.json", "model.safetensors"],
        tokenizer_files=["tokenizer.json"],
    )
    (root / "config.json").write_text(
        json.dumps(
            {
                "architectures": [manifest["architecture"]],
                "model_type": "roberta",
                "id2label": dict(enumerate(manifest["labels"])),
            }
        )
    )
    (root / "tokenizer.json").write_text("{}")
    (root / "model.safetensors").write_bytes(b"checksum fixture only; not loadable weights")
    manifest["sha256"] = {
        name: hashlib.sha256((root / name).read_bytes()).hexdigest()
        for name in manifest["files"] + manifest["tokenizer_files"]
    }
    (root / "manifest.json").write_text(json.dumps(manifest))
    return manifest


def test_corrupt_checksum_missing_tokenizer_and_undeclared_weights(tmp_path):
    root = tmp_path / "export"
    manifest = real_export(root)
    assert read_manifest(root / "manifest.json").task == "peak"
    (root / "model.safetensors").write_bytes(b"tampered")
    with pytest.raises(ManifestError, match="CHECKSUM_MISMATCH"):
        read_manifest(root / "manifest.json")
    manifest = real_export(root)
    manifest["tokenizer_files"] = []
    (root / "manifest.json").write_text(json.dumps(manifest))
    with pytest.raises(ManifestError, match="TOKENIZER_MISSING"):
        read_manifest(root / "manifest.json")
    real_export(root)
    (root / "unsafe.bin").write_bytes(b"untrusted")
    with pytest.raises(ManifestError, match="UNDECLARED_MODEL_ARTIFACT"):
        read_manifest(root / "manifest.json")


def test_invalid_adapter_base_metadata_is_not_repurposed(tmp_path):
    root = tmp_path / "adapter"
    root.mkdir()
    manifest = fixture_manifest("cbt")
    manifest["artifact_kind"] = "research_checkpoint"
    manifest["frameworks"] = {
        "torch": ">=2.6,<3",
        "transformers": ">=4.50,<5",
        "peft": ">=0.15,<1",
        "accelerate": ">=1,<2",
    }
    manifest.update(
        family="seallms",
        architecture="Qwen2ForCausalLM",
        export_format="peft_safetensors",
        base_model_id="reviewed/SeaLLMs-specific-base",
        base_version="v1",
        device="cuda",
        files=["adapter_config.json", "adapter_model.safetensors"],
    )
    (root / "adapter_config.json").write_text(
        json.dumps(
            {
                "peft_type": "LORA",
                "task_type": "CAUSAL_LM",
                "base_model_name_or_path": "old/Qwen2-export",
                "target_modules": ["q_proj"],
            }
        )
    )
    (root / "adapter_model.safetensors").write_bytes(b"checksum fixture")
    manifest["sha256"] = {
        name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in manifest["files"]
    }
    (root / "manifest.json").write_text(json.dumps(manifest))
    with pytest.raises(ManifestError, match="INVALID_LORA_ADAPTER"):
        read_manifest(root / "manifest.json")


def test_wrong_checkpoint_label_order_rejected_even_with_valid_checksums(tmp_path):
    manifest = real_export(tmp_path)
    manifest["labels"] = list(reversed(manifest["labels"]))
    (tmp_path / "manifest.json").write_text(json.dumps(manifest))
    with pytest.raises(ManifestError, match="LABEL_ORDER_MISMATCH"):
        read_manifest(tmp_path / "manifest.json")
