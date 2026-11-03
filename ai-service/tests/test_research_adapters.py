"""Fictional tiny RANDOM-weight fixtures, never research checkpoint/parity evidence."""

import asyncio
import json
from pathlib import Path

import pytest
import torch
from pydantic import ValidationError
from safetensors.torch import load_file, save_file
from transformers import (
    RobertaConfig,
    RobertaModel,
    RobertaTokenizerFast,
    XLMRobertaConfig,
    XLMRobertaForSequenceClassification,
    XLMRobertaTokenizerFast,
)

from app.core.config import Settings
from app.model.cli import fixture_manifest
from app.model.manifest import ManifestError, ModelManifest, read_manifest
from app.model.registry import ModelRegistry
from app.model.research_adapters import (
    E4EmotionAdapter,
    XlmRobertaDistressAdapter,
    aggregate_logits,
    token_windows,
)
from app.model.research_conversion import convert_heads, restricted_heads, sha256
from app.model.research_profiles import InferenceSpec

EMOTIONS = ["joy", "trust", "fear", "surprise", "sadness", "disgust", "anger", "anticipation"]
DISTRESS = ["Others", "Anxious", "Depressed", "Frustrated", "Suicidal"]


def write_json(path, value):
    Path(path).write_text(json.dumps(value), encoding="utf8")


def recipe(kind):
    return {
        "schema_version": "echo-research-inference-v1",
        "architecture": "EchoE4RobertaMultiHead"
        if kind == "e4"
        else "XLMRobertaForSequenceClassification",
        "verification": "training_source_reviewed",
        "source_reference": "FICTIONAL test recipe; NOT an attestation about either research archive",
        "evidence_files": ["fictional-training-spec.txt"],
        "normalization": "identity",
        "max_tokens": 16,
        "stride": 4,
        "stride_semantics": "overlap_tokens",
        "special_tokens": "tokenizer_defined_per_window",
        "window_weighting": "uniform",
        "aggregation": "mean_logits",
        "batch_size": 2,
        "padding_side": "right",
        "truncation_side": "right",
        "empty_input": "reject",
        "pooling": "cls_token" if kind == "e4" else None,
        "head_kind": "linear" if kind == "e4" else None,
        "encoder_pooler": False if kind == "e4" else None,
        "heads": {"plutchik": EMOTIONS, "goemotions": ["fixture_aux_a", "fixture_aux_b"]}
        if kind == "e4"
        else None,
    }


def seal(root, manifest):
    manifest["files"] = sorted(
        p.relative_to(root).as_posix()
        for p in root.rglob("*")
        if p.is_file()
        and p.name != "manifest.json"
        and p.relative_to(root).as_posix() not in manifest["tokenizer_files"]
    )
    manifest["sha256"] = {
        name: sha256(root / name) for name in manifest["files"] + manifest["tokenizer_files"]
    }
    if manifest.get("calibration_file"):
        cal = json.loads((root / manifest["calibration_file"]).read_text())
        cal.update(
            model_config_sha256=manifest["sha256"]["config.json"],
            model_weights_sha256=manifest["sha256"]["model.safetensors"],
        )
        write_json(root / manifest["calibration_file"], cal)
        manifest["sha256"][manifest["calibration_file"]] = sha256(
            root / manifest["calibration_file"]
        )
    write_json(root / "manifest.json", manifest)
    return manifest


@pytest.fixture
def bundle(tmp_path):
    def build(kind="xlmr"):
        from tokenizers import Tokenizer, decoders, models, pre_tokenizers, processors, trainers

        root = tmp_path / kind
        root.mkdir()
        torch.manual_seed(731)
        if kind == "e4":
            from tokenizers import ByteLevelBPETokenizer

            tokenizer = ByteLevelBPETokenizer()
            tokenizer.train_from_iterator(
                ["Fictional student had a kind afternoon. Masaya ako ngayon."] * 4,
                vocab_size=280,
                special_tokens=["<s>", "<pad>", "</s>", "<unk>", "<mask>"],
            )
            tokenizer.save_model(str(root))
            hf = RobertaTokenizerFast(
                vocab_file=str(root / "vocab.json"),
                merges_file=str(root / "merges.txt"),
                model_max_length=64,
            )
        else:
            tokenizer = Tokenizer(models.Unigram())
            tokenizer.pre_tokenizer = pre_tokenizers.Metaspace()
            tokenizer.decoder = decoders.Metaspace()
            tokenizer.train_from_iterator(
                ["Fictional student had a kind afternoon. Masaya ako ngayon. Unicode café 漢字."]
                * 4,
                trainers.UnigramTrainer(
                    vocab_size=70,
                    unk_token="<unk>",
                    special_tokens=["<s>", "<pad>", "</s>", "<unk>", "<mask>"],
                ),
            )
            tokenizer.post_processor = processors.TemplateProcessing(
                single="<s> $A </s>", special_tokens=[("<s>", 0), ("</s>", 2)]
            )
            hf = XLMRobertaTokenizerFast(tokenizer_object=tokenizer, model_max_length=64)
        hf.save_pretrained(root)
        tokenizer_files = sorted(p.name for p in root.iterdir() if p.is_file())
        config_args = {
            "vocab_size": len(hf),
            "hidden_size": 16,
            "num_hidden_layers": 1,
            "num_attention_heads": 2,
            "intermediate_size": 24,
            "max_position_embeddings": 66,
            "bos_token_id": hf.bos_token_id,
            "eos_token_id": hf.eos_token_id,
            "pad_token_id": hf.pad_token_id,
        }
        spec = recipe(kind)
        m = fixture_manifest("peak" if kind == "e4" else "distress")
        m.update(
            model_id="fictional-random-" + kind,
            family="roberta" if kind == "e4" else "xlm_roberta",
            architecture=spec["architecture"],
            export_format="echo_e4_safetensors" if kind == "e4" else "hf_safetensors",
            tokenizer_files=tokenizer_files,
            labels=EMOTIONS if kind == "e4" else DISTRESS,
            preprocessing={
                "normalization": "identity",
                "max_tokens": 16,
                "stride": 4,
                "max_windows": 32,
                "aggregation": "mean_logits",
                "truncation": "reject",
            },
            inference_spec_file="inference-spec.json",
            research_status="provisional_nonfinal",
            frameworks={"torch": ">=2.6,<3", "transformers": ">=4.50,<5"},
            provenance={
                "source": "Fictional RANDOM-weight unit-test artifact; no trained research model"
            },
        )
        if kind == "e4":
            encoder = RobertaModel(RobertaConfig(**config_args), add_pooling_layer=False)
            encoder.save_pretrained(root / "encoder", safe_serialization=True)
            heads = torch.nn.ModuleDict(
                {name: torch.nn.Linear(16, len(labels)) for name, labels in spec["heads"].items()}
            )
            save_file(heads.state_dict(), root / "heads.safetensors")
            write_json(
                root / "e4_config.json",
                {
                    "has_trained_go_aux_head": True,
                    "plutchik_labels": EMOTIONS,
                    "goemotions_labels": spec["heads"]["goemotions"],
                },
            )
            m["calibration"] = {
                "semantics": "softmax",
                "method": "uncalibrated",
                "temperature": 1,
                "documentation": "FICTIONAL uncalibrated test recipe; no claim about real E4 calibration",
            }
        else:
            model = XLMRobertaForSequenceClassification(
                XLMRobertaConfig(
                    **config_args,
                    id2label=dict(enumerate(DISTRESS)),
                    label2id={v: i for i, v in enumerate(DISTRESS)},
                )
            )
            model.save_pretrained(root, safe_serialization=True)
            m["calibration_file"] = "calibration.json"
            m["calibration"] = {
                "semantics": "softmax",
                "method": "temperature",
                "temperature": 1.630744207618722,
                "documentation": "Fictional weights; test the documented mean-logit temperature formula only",
            }
            write_json(
                root / "calibration.json",
                {
                    "schema": "ECHO_XLMR_V2_WINDOW_CALIBRATED",
                    "class_order": DISTRESS,
                    "temperature": m["calibration"]["temperature"],
                    "stride": 4,
                    "aggregation": "softmax(mean_window_logits / temperature)",
                },
            )
        write_json(root / "inference-spec.json", spec)
        (root / "fictional-training-spec.txt").write_text(
            "This is a controlled fictional recipe for random-weight tests, not E4/XLM-R source evidence."
        )
        seal(root, m)
        return root, m

    return build


def test_mean_logits_temperature_is_not_probability_averaging(bundle):
    root, _ = bundle()
    m = read_manifest(root / "manifest.json", synthetic=True)
    logits = torch.tensor([[8.0, 0, 0, 0, -2], [-2.0, 0, 0, 0, 0]])
    actual = torch.tensor([s["probability"] for s in aggregate_logits(logits, m)["scores"]])
    expected = (logits.mean(0) / m.calibration.temperature).softmax(-1)
    wrong = (logits / m.calibration.temperature).softmax(-1).mean(0)
    torch.testing.assert_close(actual, expected, rtol=1e-6, atol=1e-7)
    assert (actual - wrong).abs().max() > 0.05


@pytest.mark.parametrize(
    "kind,adapter,count", [("e4", E4EmotionAdapter, 8), ("xlmr", XlmRobertaDistressAdapter, 5)]
)
def test_actual_tiny_random_forward_cpu_labels_top_five_repeat_and_unicode(
    bundle, kind, adapter, count
):
    root, _ = bundle(kind)
    m = read_manifest(root / "manifest.json", synthetic=True)
    runtime = adapter(root, m)
    for text in ("Kind afternoon", "Masaya ako ngayon. Café 漢字."):
        output = runtime.infer(text)
        assert [s["label"] for s in output["scores"]] == m.labels
        assert len(output["scores"]) == count and len(output["topFive"]) == 5
        assert (
            output["topFive"]
            == sorted(output["scores"], key=lambda s: s["probability"], reverse=True)[:5]
        )
        assert abs(sum(s["probability"] for s in output["scores"]) - 1) < 1e-6
        assert (
            output["supportFlags"] is None and "not clinically validated" in output["calibration"]
        )
        assert runtime.infer(text) == output
    model = runtime.encoder if kind == "e4" else runtime.model
    assert next(model.parameters()).device.type == "cpu"
    long = runtime.infer("kind " * 60)
    assert long["windowsProcessed"] > 1 and not long["truncated"]


def test_xlmr_reference_forward_matches_direct_hf_for_fictional_recipe(bundle):
    root, _ = bundle()
    m = read_manifest(root / "manifest.json", synthetic=True)
    adapter = XlmRobertaDistressAdapter(root, m)
    windows, _ = token_windows(adapter.tokenizer, "Kind afternoon", adapter.spec, m.preprocessing)
    batch = adapter.tokenizer.pad(windows, return_tensors="pt")
    direct = XLMRobertaForSequenceClassification.from_pretrained(
        root, local_files_only=True, use_safetensors=True
    ).eval()
    with torch.inference_mode():
        expected = direct(**batch).logits
    actual, _ = adapter.window_logits("Kind afternoon")
    torch.testing.assert_close(actual, expected, rtol=1e-5, atol=1e-7)


@pytest.mark.parametrize(
    "pooling,pooler", [("cls_token", False), ("masked_mean", False), ("pooler_output", True)]
)
def test_e4_explicit_recipe_pooling_and_linear_forward(bundle, pooling, pooler):
    root, m = bundle("e4")
    spec = recipe("e4") | {"pooling": pooling, "encoder_pooler": pooler}
    write_json(root / "inference-spec.json", spec)
    if pooler:
        config = RobertaConfig.from_pretrained(root / "encoder", local_files_only=True)
        RobertaModel(config, add_pooling_layer=True).save_pretrained(
            root / "encoder", safe_serialization=True
        )
    seal(root, m)
    adapter = E4EmotionAdapter(root, read_manifest(root / "manifest.json", synthetic=True))
    windows, _ = token_windows(
        adapter.tokenizer, "Kind afternoon", adapter.spec, adapter.manifest.preprocessing
    )
    batch = adapter.tokenizer.pad(windows, return_tensors="pt")
    with torch.inference_mode():
        output = adapter.encoder(**batch)
        if pooling == "cls_token":
            features = output.last_hidden_state[:, 0]
        elif pooling == "masked_mean":
            mask = batch["attention_mask"].unsqueeze(-1)
            features = (output.last_hidden_state * mask).sum(1) / mask.sum(1)
        else:
            features = output.pooler_output
        heads = load_file(root / "heads.safetensors")
        expected = features @ heads["plutchik.weight"].T + heads["plutchik.bias"]
    actual, _ = adapter.window_logits("Kind afternoon")
    torch.testing.assert_close(actual, expected, rtol=1e-5, atol=1e-7)


@pytest.mark.parametrize("kind", ["e4", "xlmr"])
def test_missing_source_recipe_and_checksum_cannot_activate(bundle, kind):
    root, m = bundle(kind)
    (root / "inference-spec.json").unlink()  # disposable fictional pytest bundle only
    with pytest.raises(ManifestError, match="ARTIFACT_MISSING"):
        read_manifest(root / "manifest.json", synthetic=True)
    m["inference_spec_file"] = None
    with pytest.raises(ValidationError, match="reviewed inference specification"):
        ModelManifest.model_validate(m)


@pytest.mark.parametrize(
    "change",
    [
        {"stride_semantics": "unknown"},
        {"pooling": None},
        {"head_kind": None},
        {"heads": {"plutchik": EMOTIONS[::-1]}},
        {"encoder_pooler": None},
    ],
)
def test_e4_missing_or_conflicting_forward_details_rejected(bundle, change):
    root, m = bundle("e4")
    write_json(root / "inference-spec.json", recipe("e4") | change)
    seal(root, m)
    with pytest.raises(ManifestError):
        read_manifest(root / "manifest.json", synthetic=True)


@pytest.mark.parametrize(
    "fault", ["missing", "wrong_temperature", "wrong_labels", "wrong_weights", "wrong_formula"]
)
def test_missing_or_mismatched_calibration_rejected(bundle, fault):
    root, m = bundle()
    path = root / "calibration.json"
    if fault == "missing":
        path.unlink()
    else:
        cal = json.loads(path.read_text())
        cal.update(
            {
                "wrong_temperature": {"temperature": 3},
                "wrong_labels": {"class_order": DISTRESS[::-1]},
                "wrong_weights": {"model_weights_sha256": "0" * 64},
                "wrong_formula": {"aggregation": "mean(softmax(logits))"},
            }[fault]
        )
        write_json(path, cal)
        m["sha256"]["calibration.json"] = sha256(path)
        write_json(root / "manifest.json", m)
    with pytest.raises(ManifestError):
        read_manifest(root / "manifest.json", synthetic=True)


@pytest.mark.parametrize("kind", ["e4", "xlmr"])
@pytest.mark.parametrize("fault", ["missing", "unexpected", "shape"])
def test_tensor_coverage_never_random_initializes_missing_weights(bundle, kind, fault):
    root, m = bundle(kind)
    path = root / ("heads.safetensors" if kind == "e4" else "model.safetensors")
    # Detach from safetensors' memory-mapped file before rewriting it on Windows.
    state = {name: tensor.clone() for name, tensor in load_file(path).items()}
    key = next(iter(state))
    if fault == "missing":
        del state[key]
    elif fault == "unexpected":
        state["fictional_unexpected_parameter"] = torch.zeros(2)
    else:
        state[key] = torch.zeros(3)
    save_file(state, path)
    seal(root, m)
    manifest = read_manifest(root / "manifest.json", synthetic=True)
    with pytest.raises(ManifestError, match="CHECKPOINT_PARAMETERS"):
        (E4EmotionAdapter if kind == "e4" else XlmRobertaDistressAdapter)(root, manifest)


class CountingTokenizer:
    def __call__(self, text, **kwargs):
        return {"input_ids": list(range(len(text)))}

    def num_special_tokens_to_add(self, **kwargs):
        return 2

    def prepare_for_model(self, ids, **kwargs):
        return {"input_ids": [99, *ids, 100], "attention_mask": [1] * (len(ids) + 2)}


def test_stride_step_vs_overlap_and_no_duplicate_final_window():
    spec = InferenceSpec.model_validate(recipe("xlmr") | {"max_tokens": 8, "stride": 2})
    p = ModelManifest.model_validate(fixture_manifest("distress")).preprocessing.model_copy(
        update={"max_windows": 10}
    )
    windows, _ = token_windows(CountingTokenizer(), "abcdefghijklmn", spec, p)
    assert [w["input_ids"][1] for w in windows] == [0, 4, 8]
    windows, _ = token_windows(
        CountingTokenizer(),
        "abcdefghijklmn",
        spec.model_copy(update={"stride_semantics": "step_tokens"}),
        p,
    )
    assert [w["input_ids"][1] for w in windows] == [0, 2, 4, 6, 8]


@pytest.mark.parametrize(
    "text,code",
    [("", "EMPTY_MODEL_INPUT"), (" \n ", "EMPTY_MODEL_INPUT"), ("a" * 20_001, "INPUT_TOKEN_LIMIT")],
)
def test_empty_and_overlong_inputs_fail_before_inference(text, code):
    p = ModelManifest.model_validate(fixture_manifest("distress")).preprocessing
    with pytest.raises(ManifestError, match=code):
        token_windows(CountingTokenizer(), text, InferenceSpec.model_validate(recipe("xlmr")), p)


def test_overflow_bound_and_explicit_truncation():
    p = ModelManifest.model_validate(fixture_manifest("distress")).preprocessing
    spec = InferenceSpec.model_validate(recipe("xlmr"))
    with pytest.raises(ManifestError, match="INPUT_TOKEN_LIMIT"):
        token_windows(CountingTokenizer(), "a" * 100, spec, p)
    windows, truncated = token_windows(
        CountingTokenizer(),
        "a" * 100,
        spec,
        p.model_copy(update={"truncation": "documented_truncate"}),
    )
    assert truncated and len(windows) == 1


def test_optional_window_flag_uses_explicit_temperature_and_label_not_top_one(bundle):
    root, m = bundle()
    m["support_mapping"] = {
        "approved_reference": "FICTIONAL mathematical mapping, NOT clinical validation",
        "minimum_probability": 0.5,
        "label_flags": {"Suicidal": ["fictional_follow_up"]},
        "score_strategy": "max_window_label_probability",
        "window_temperature": 1,
    }
    cal = json.loads((root / "calibration.json").read_text())
    cal.update(
        flag_score="max_window_softmax_suicidal_label", suicidal_label_flag={"threshold": 0.5}
    )
    write_json(root / "calibration.json", cal)
    write_json(root / "inference-spec.json", recipe("xlmr") | {"support_flag_temperature": 1})
    seal(root, m)
    manifest = read_manifest(root / "manifest.json", synthetic=True)
    result = aggregate_logits(torch.tensor([[0.0, 0, 0, 0, 8], [20.0, 0, 0, 0, 0]]), manifest)
    assert result["topFive"][0]["label"] == "Others"
    assert result["supportFlags"] == ["fictional_follow_up"]
    m["support_mapping"].pop("window_temperature")
    with pytest.raises(ValidationError, match="explicitly reviewed temperature"):
        ModelManifest.model_validate(m)


def test_registry_explicit_selection_partial_results_concurrency_and_synthetic_isolation(bundle):
    root, m = bundle()
    settings = Settings(
        _env_file=None,
        app_env="test",
        echo_models_dir=root,
        echo_execution_mode="synthetic",
        echo_active_models={"distress": m["model_id"] + "@" + m["version"]},
        echo_queue_capacity=2,
        echo_stage_timeout_seconds=30,
    )
    registry = ModelRegistry(settings)
    try:

        async def run():
            return await asyncio.gather(
                registry.stage("distress", "Kind afternoon"),
                registry.stage("peak", "Kind afternoon"),
            )

        distress, missing = asyncio.run(run())
        assert distress["status"] == "completed", distress
        assert (
            distress["modelId"] == "fictional-random-xlmr"
            and distress["executionMode"] == "synthetic"
        )
        assert missing["result"] is None and missing["errorCode"] == "MODEL_NOT_ENABLED"
        instance = registry.adapters[(m["model_id"], m["version"])]
        assert asyncio.run(registry.stage("distress", "Kind afternoon"))["status"] == "completed"
        assert registry.adapters[(m["model_id"], m["version"])] is instance
    finally:
        registry.close()
    with pytest.raises(ManifestError, match="SYNTHETIC_ARTIFACT_REFUSED"):
        read_manifest(root / "manifest.json", synthetic=False)


def test_restricted_tensor_conversion_preserves_source_exact_values_and_no_overwrite(tmp_path):
    source, target = tmp_path / "heads.pt", tmp_path / "heads.safetensors"
    original = {
        "research_head.weight": torch.arange(12, dtype=torch.float32).reshape(3, 4),
        "research_head.bias": torch.zeros(3),
    }
    torch.save(original, source)
    digest = sha256(source)
    mapping = {"research_head.weight": "plutchik.weight", "research_head.bias": "plutchik.bias"}
    report = convert_heads(
        source, target, digest, mapping, {"plutchik.weight": [3, 4], "plutchik.bias": [3]}
    )
    assert report["source_preserved"] and sha256(source) == digest
    converted = load_file(target)
    for key, value in original.items():
        torch.testing.assert_close(converted[mapping[key]], value, rtol=0, atol=0)
    with pytest.raises(ManifestError, match="DESTINATION_MUST_BE_NEW"):
        convert_heads(source, target, digest, mapping, {})


class ForbiddenObject:
    def __reduce__(self):
        return (eval, ("1+1",))


def test_restricted_conversion_refuses_objects_non_tensor_and_bad_hash(tmp_path):
    source = tmp_path / "untrusted.pt"
    torch.save({"object": ForbiddenObject()}, source)
    with pytest.raises(ManifestError, match="UNSAFE_HEAD_SERIALIZATION_REFUSED"):
        restricted_heads(source, sha256(source))
    torch.save({"metadata": "not a tensor"}, source)
    with pytest.raises(ManifestError, match="INVALID_HEAD_TENSOR"):
        restricted_heads(source, sha256(source))
    with pytest.raises(ManifestError, match="CHECKSUM_MISMATCH"):
        restricted_heads(source, "0" * 64)


@pytest.mark.parametrize(
    "key_map,shapes", [({}, {}), ({"w": "plutchik.weight"}, {"plutchik.weight": [4, 4]})]
)
def test_conversion_requires_exact_key_mapping_and_shapes(tmp_path, key_map, shapes):
    source, target = tmp_path / "heads.pt", tmp_path / "heads.safetensors"
    torch.save({"w": torch.zeros(3, 4)}, source)
    with pytest.raises(ManifestError):
        convert_heads(source, target, sha256(source), key_map, shapes)
    assert not target.exists()


def test_restricted_conversion_bounds_decompressed_storage_before_torch_load(tmp_path, monkeypatch):
    import zipfile

    import app.model.research_conversion as conversion

    source = tmp_path / "oversized-storage.pt"
    with zipfile.ZipFile(source, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("state/data.pkl", b"not executed")
        archive.writestr("state/data/0", bytes(2048))
    monkeypatch.setattr(conversion, "MAX_HEAD_BYTES", 1024)
    monkeypatch.setattr(torch, "load", lambda *a, **kw: pytest.fail("Must reject before loading"))
    with pytest.raises(ManifestError, match="HEAD_ARCHIVE_BUDGET_EXCEEDED"):
        restricted_heads(source, sha256(source))


def test_source_threshold_and_tokenizer_mismatch_are_not_silently_accepted(bundle):
    root, m = bundle()
    m["support_mapping"] = {
        "approved_reference": "FICTIONAL mapping that deliberately disagrees with source",
        "minimum_probability": 0.9,
        "label_flags": {"Suicidal": ["fictional_flag"]},
        "score_strategy": "max_window_label_probability",
        "window_temperature": 1,
    }
    seal(root, m)
    with pytest.raises(ManifestError, match="SOURCE_SUPPORT_MAPPING_MISMATCH"):
        read_manifest(root / "manifest.json", synthetic=True)
    m["support_mapping"] = None
    config = json.loads((root / "config.json").read_text())
    config["pad_token_id"] = 3
    write_json(root / "config.json", config)
    seal(root, m)
    with pytest.raises(ManifestError, match="TOKENIZER_MODEL_MISMATCH"):
        XlmRobertaDistressAdapter(root, read_manifest(root / "manifest.json", synthetic=True))


def test_actual_archive_metadata_is_not_enough_to_manufacture_a_recipe():
    evidence_path = (
        Path(__file__).resolve().parent
        / "fixtures/archive-compatibility-metadata.json"
    )
    evidence = json.loads(evidence_path.read_text(encoding="utf8"))
    for archive in evidence["archives"]:
        assert not any(
            e["name"].endswith((".py", "inference-spec.json")) for e in archive["entries"]
        )
    distress = evidence["archives"][1]
    source = {Path(m["path"]).name: m["content"] for m in distress["metadata"]}
    assert (
        source["calibration.json"]["class_order"]
        == source["training_manifest.json"]["class_order"]
        == DISTRESS
    )
    m = fixture_manifest("distress") | {
        "family": "xlm_roberta",
        "architecture": "XLMRobertaForSequenceClassification",
        "export_format": "hf_safetensors",
        "research_status": "provisional_nonfinal",
        "frameworks": {"torch": ">=2.6,<3", "transformers": ">=4.50,<5"},
    }
    with pytest.raises(ValidationError, match="reviewed inference specification"):
        ModelManifest.model_validate(m)


def test_e4_sigmoid_max_window_scores_are_independent_not_a_distribution(bundle):
    root, m = bundle("e4")
    m["calibration"]["semantics"] = "sigmoid"
    m["preprocessing"]["aggregation"] = "max_probabilities"
    write_json(root / "inference-spec.json", recipe("e4") | {"aggregation": "max_probabilities"})
    seal(root, m)
    manifest = read_manifest(root / "manifest.json", synthetic=True)
    logits = torch.tensor([[2.0] * 8, [1.0] * 8])
    result = aggregate_logits(logits, manifest)
    assert result["semantics"] == "sigmoid"
    assert sum(s["probability"] for s in result["scores"]) > 1
    expected = logits.sigmoid().max(0).values
    torch.testing.assert_close(torch.tensor([s["probability"] for s in result["scores"]]), expected)


def test_corrupt_weights_and_unapproved_serialization_never_enter_runtime(bundle):
    root, m = bundle("e4")
    (root / "heads.safetensors").write_bytes(b"not a valid tensor file")
    with pytest.raises(ManifestError, match="CHECKSUM_MISMATCH"):
        read_manifest(root / "manifest.json", synthetic=True)
    (root / "heads.pt").write_bytes(b"must never be unpickled by the serving process")
    seal(root, m)
    with pytest.raises(ManifestError, match="UNTRUSTED_SERIALIZATION_REFUSED"):
        read_manifest(root / "manifest.json", synthetic=True)


@pytest.mark.parametrize("command", ["validate", "smoke"])
def test_cli_required_tasks_do_not_report_success_with_no_active_models(
    tmp_path, monkeypatch, capsys, command
):
    from app.model import cli

    monkeypatch.setattr(
        cli,
        "Settings",
        lambda: Settings(
            _env_file=None, app_env="test", echo_models_dir=tmp_path, echo_execution_mode="real"
        ),
    )
    monkeypatch.setattr(
        "sys.argv", ["model-cli", command, "--require-task", "peak", "--require-task", "distress"]
    )
    with pytest.raises(SystemExit) as exit_info:
        cli.main()
    assert exit_info.value.code == 2
    assert "MODEL_NOT_ENABLED" in capsys.readouterr().out


def test_new_profiles_preserve_internal_auth_urgent_guard_and_production_exclusion(
    bundle, tmp_path, monkeypatch
):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.routes.pipeline import router
    from app.core.config import get_settings

    monkeypatch.setenv("AI_SERVICE_TOKEN", "fictional-internal-test-token")
    get_settings.cache_clear()
    _, e4 = bundle("e4")
    _, xlmr = bundle()
    settings = Settings(
        _env_file=None,
        app_env="test",
        echo_models_dir=tmp_path,
        echo_execution_mode="synthetic",
        echo_active_models={
            "peak": e4["model_id"] + "@" + e4["version"],
            "distress": xlmr["model_id"] + "@" + xlmr["version"],
        },
    )
    registry = ModelRegistry(settings)
    app = FastAPI()
    app.state.pipeline_registry = registry
    app.include_router(router)
    headers = {"Authorization": "Bearer fictional-internal-test-token"}
    try:
        with TestClient(app) as client:
            assert (
                client.post("/engineering/v2/analyze", json={"text": "Fictional afternoon"}).status_code == 401
            )
            response = client.post(
                "/engineering/v2/analyze", json={"text": "Fictional afternoon"}, headers=headers
            )
            assert response.status_code == 200, response.text
            result = response.json()
            assert result["isSimulated"] and result["overallStatus"] == "partial"
            assert all(
                result["stages"][task]["status"] == "completed" for task in ("peak", "distress")
            )
            assert all(result["stages"][task]["result"] is None for task in ("phq8", "cbt", "face"))
            assert (
                client.post(
                    "/engineering/v2/analyze", json={"text": "I want to die"}, headers=headers
                ).status_code
                == 409
            )
            assert client.post("/engineering/v2/analyze", json={"text": ""}, headers=headers).status_code == 422
            registry.settings = settings.model_copy(
                update={"app_env": "production", "echo_execution_mode": "real"}
            )
            assert (
                client.post(
                    "/engineering/v2/analyze", json={"text": "Fictional afternoon"}, headers=headers
                ).status_code
                == 503
            )
    finally:
        registry.close()
        get_settings.cache_clear()
