"""Offline model validation, synthetic installation, and tiny random-weight smoke tooling."""

import argparse
import asyncio
import hashlib
import json
from pathlib import Path
from importlib.metadata import version as package_version

from app.core.config import Settings
from app.model.registry import TASKS, ModelRegistry


def fixture_manifest(task):
    return {
        "schema_version": "echo-model-manifest-v1",
        "artifact_kind": "synthetic_engineering",
        "model_id": f"echo-synthetic-{task}",
        "version": "fixture-v1",
        "task": task,
        "family": "synthetic",
        "architecture": "EchoSyntheticV1",
        "export_format": "synthetic_fixture",
        "files": [],
        "tokenizer_files": [],
        "labels": (
            [f"fixture_emotion_{c}" for c in "abcde"]
            if task == "peak"
            else [f"fixture_class_{i}" for i in range(5)]
            if task == "distress"
            else []
        ),
        "preprocessing": {"normalization": "identity", "max_tokens": 128},
        "calibration": {
            "semantics": "softmax" if task in ("peak", "distress") else "structured_generation",
            "method": "uncalibrated",
            "documentation": "Deterministic synthetic engineering fixture; not trained inference.",
        },
        "output_schema": f"echo-{task}-v1",
        "device": "cpu",
        "frameworks": {},
        "sha256": {},
        "provenance": {"source": "fictional local test fixture"},
        "readiness": "engineering_only",
    }


def engineering_destination(path):
    allowed = Path(__file__).resolve().parents[3] / "backend" / "models" / ".engineering"
    if not path.resolve().is_relative_to(allowed.resolve()) or path.is_symlink():
        raise ValueError("Fixture writes are restricted to backend/models/.engineering")
    path.mkdir(parents=True, exist_ok=True)


def install_synthetic(root):
    engineering_destination(root)
    for task in ("peak", "distress", "phq8", "cbt"):
        path = root / task
        path.mkdir(exist_ok=True)
        manifest = path / "manifest.json"
        if manifest.exists():
            raise ValueError("Existing fixture export preserved; choose a new destination")
        manifest.write_text(json.dumps(fixture_manifest(task), indent=2), encoding="utf8")


def tiny_roberta(root):
    engineering_destination(root)
    if any(root.iterdir()):
        raise ValueError("Tiny artifact destination must be empty; existing files preserved")
    import torch
    from tokenizers import ByteLevelBPETokenizer
    from transformers import RobertaConfig, RobertaForSequenceClassification, RobertaTokenizerFast

    torch.manual_seed(42)
    tokenizer = ByteLevelBPETokenizer()
    tokenizer.train_from_iterator(
        ["Fictional student reflects on a small kind action today."] * 20,
        vocab_size=300,
        min_frequency=1,
        special_tokens=["<s>", "<pad>", "</s>", "<unk>", "<mask>"],
    )
    tokenizer.save_model(str(root))
    hf = RobertaTokenizerFast(
        tokenizer_object=tokenizer._tokenizer,
        vocab_file=str(root / "vocab.json"),
        merges_file=str(root / "merges.txt"),
        model_max_length=64,
    )
    hf.save_pretrained(root)
    labels = [f"random_fixture_label_{i}" for i in range(5)]
    config = RobertaConfig(
        vocab_size=len(hf),
        hidden_size=16,
        num_hidden_layers=1,
        num_attention_heads=2,
        intermediate_size=24,
        max_position_embeddings=66,
        id2label=dict(enumerate(labels)),
        label2id={label: i for i, label in enumerate(labels)},
    )
    model = RobertaForSequenceClassification(config)
    model.save_pretrained(root, safe_serialization=True)
    manifest = fixture_manifest("peak")
    manifest.update(
        model_id="echo-random-roberta-engineering",
        version="tiny-v1",
        family="roberta",
        architecture="RobertaForSequenceClassification",
        export_format="hf_safetensors",
        labels=labels,
        preprocessing={"normalization": "identity", "max_tokens": 64, "max_windows": 8},
        frameworks={name: f"=={package_version(name)}" for name in ("torch", "transformers")},
        provenance={
            "source": "Seeded RANDOM WEIGHTS; fictional tokenizer corpus; no trained research model"
        },
    )
    manifest["files"] = ["config.json", "model.safetensors"]
    manifest["tokenizer_files"] = [
        p.name for p in root.iterdir() if p.name not in manifest["files"]
    ]
    for name in manifest["files"] + manifest["tokenizer_files"]:
        manifest["sha256"][name] = hashlib.sha256((root / name).read_bytes()).hexdigest()
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "command",
        choices=[
            "validate",
            "smoke",
            "install-synthetic",
            "tiny-roberta",
            "validate-diagnostic",
            "diagnose",
        ],
    )
    parser.add_argument("--directory", type=Path)
    parser.add_argument(
        "--text", default="Fictional student completed a small task and took a calm walk."
    )
    parser.add_argument(
        "--require-task",
        choices=TASKS,
        action="append",
        default=[],
        help="Exit 2 unless each required task validates (validate) or completes (smoke).",
    )
    parser.add_argument(
        "--exploratory-pooling",
        choices=["cls", "masked_mean"],
        help="CLI-only E4 reconstruction assumption; never verified research inference",
    )
    args = parser.parse_args()
    if args.exploratory_pooling and args.command != "diagnose":
        parser.error("Exploratory pooling is available only in CLI diagnostics")
    if args.command in ("install-synthetic", "tiny-roberta"):
        if not args.directory:
            parser.error("--directory is required")
        (install_synthetic if args.command == "install-synthetic" else tiny_roberta)(args.directory)
        print("Local engineering artifacts written; no research checkpoints downloaded.")
        return
    settings = Settings()
    if args.command in ("validate-diagnostic", "diagnose"):
        if not args.directory:
            parser.error("Diagnostic commands require --directory")
        from app.model.diagnostic import run_diagnostic, validate_diagnostic

        if args.command == "validate-diagnostic":
            manifest, _ = validate_diagnostic(args.directory, settings)
            print(
                json.dumps(
                    {
                        "status": "validated_not_loaded",
                        "readiness": manifest.readiness,
                        "application_eligible": False,
                        "calibration_binding": manifest.calibration_binding,
                        "model_id": manifest.model_id,
                    },
                    indent=2,
                )
            )
        else:
            print(
                json.dumps(
                    run_diagnostic(args.directory, settings, args.text, args.exploratory_pooling),
                    indent=2,
                )
            )
        return
    if args.directory:
        settings.echo_models_dir = args.directory
    runtime = ModelRegistry(settings)
    try:
        if args.command == "validate":
            status = runtime.status()
            print(json.dumps(status, indent=2))
            if runtime.errors:
                raise SystemExit(1)
            if any(
                status["models"][task]["status"] != "validated_not_loaded"
                for task in args.require_task
            ):
                raise SystemExit(2)
        else:

            async def smoke():
                return {
                    task: await runtime.stage(task, "Fictional student reflects on a kind action.")
                    for task in ("peak", "distress", "phq8", "cbt", "face")
                }

            results = asyncio.run(smoke())
            print(json.dumps(results, indent=2))
            if any(results[task]["status"] != "completed" for task in args.require_task):
                raise SystemExit(2)
    finally:
        runtime.close()


if __name__ == "__main__":
    main()
