"""Local exporter contract. Metadata is configuration, never executable checkpoint code."""

import hashlib
import json
from pathlib import Path
from typing import Literal

from packaging.specifiers import SpecifierSet
from pydantic import BaseModel, ConfigDict, Field, model_validator


class ManifestError(ValueError):
    pass


class Preprocessing(BaseModel):
    model_config = ConfigDict(extra="forbid")
    normalization: Literal["identity", "unicode_nfc"]
    max_tokens: int = Field(ge=8, le=8192)
    stride: int = Field(default=0, ge=0, le=4096)
    max_windows: int = Field(default=1, ge=1, le=32)
    aggregation: Literal["mean_probabilities", "mean_logits", "max_probabilities"] = (
        "mean_probabilities"
    )
    truncation: Literal["reject", "documented_truncate"] = "reject"


class Calibration(BaseModel):
    model_config = ConfigDict(extra="forbid")
    semantics: Literal["softmax", "sigmoid", "structured_generation"]
    method: Literal["uncalibrated", "temperature", "not_applicable"]
    temperature: float = Field(default=1.0, gt=0, le=100)
    documentation: str = Field(min_length=10, max_length=2000)


class SupportMapping(BaseModel):
    model_config = ConfigDict(extra="forbid")
    approved_reference: str = Field(min_length=10, max_length=500)
    # No built-in distress-to-suicide-risk mapping. Researchers must supply reviewed rules.
    minimum_probability: float = Field(ge=0, le=1)
    label_flags: dict[str, list[str]]
    score_strategy: Literal["top_class", "max_window_label_probability"] = "top_class"
    window_temperature: float | None = Field(default=None, gt=0, le=100)


class ModelManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal["echo-model-manifest-v1"]
    artifact_kind: Literal["research_checkpoint", "synthetic_engineering"]
    model_id: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._/-]{1,159}$")
    version: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")
    task: Literal["peak", "distress", "phq8", "cbt", "face", "base"]
    family: Literal[
        "roberta", "xlm_roberta", "sea_lion", "seallms", "qwen2_cbt", "echo_face", "synthetic"
    ]
    architecture: str = Field(min_length=3, max_length=120)
    export_format: Literal[
        "hf_safetensors", "echo_e4_safetensors", "peft_safetensors", "synthetic_fixture", "deferred"
    ]
    inference_spec_file: str | None = None
    calibration_file: str | None = None
    research_status: Literal["provisional_nonfinal", "research_unvalidated"] | None = None
    base_model_id: str | None = None
    base_version: str | None = None
    files: list[str] = Field(max_length=1000)
    tokenizer_files: list[str] = Field(max_length=30)
    labels: list[str] = Field(max_length=200)
    preprocessing: Preprocessing
    calibration: Calibration
    output_schema: str = Field(min_length=3, max_length=120)
    support_mapping: SupportMapping | None = None
    device: Literal["cpu", "cuda"]
    quantization: Literal["none", "nf4"] = "none"
    compute_dtype: Literal["float16", "bfloat16"] = "float16"
    minimum_vram_gb: float = Field(default=0, ge=0, le=1000)
    frameworks: dict[str, str]
    sha256: dict[str, str]
    provenance: dict[str, str]
    readiness: Literal["disabled", "engineering_only"] = "disabled"
    safety_review_reference: str | None = None

    @model_validator(mode="after")
    def compatible_contract(self):
        if (
            self.export_format == "synthetic_fixture"
            and self.artifact_kind != "synthetic_engineering"
        ):
            raise ValueError("Synthetic fixture provenance must be explicit")
        if self.output_schema != f"echo-{self.task}-v1":
            raise ValueError("Unsupported model output schema")
        for package, specifier in self.frameworks.items():
            if package not in {
                "torch",
                "transformers",
                "peft",
                "safetensors",
                "accelerate",
                "bitsandbytes",
                "tokenizers",
                "sentencepiece",
            }:
                raise ValueError("Unsupported inference framework declaration")
            SpecifierSet(specifier)
        if self.export_format in ("hf_safetensors", "echo_e4_safetensors", "peft_safetensors"):
            required = {"torch", "transformers"}
            if self.export_format == "peft_safetensors":
                required.update({"peft", "accelerate"})
            if (
                not required.issubset(self.frameworks)
                or len(self.provenance.get("source", "")) < 10
            ):
                raise ValueError(
                    "Real exports require framework versions and reviewed export provenance"
                )
        if self.calibration.method == "uncalibrated" and self.calibration.temperature != 1:
            raise ValueError("Temperature scaling requires explicit calibration metadata")
        if (
            self.task in ("peak", "distress")
            and self.calibration.semantics == "structured_generation"
        ):
            raise ValueError("Classifier probability semantics required")
        if self.task == "peak" and len(self.labels) < 5:
            raise ValueError(
                "PEAK requires the actual ordered label list with at least five labels"
            )
        if self.task == "distress" and len(self.labels) != 5:
            raise ValueError("Distress requires exactly five checkpoint-defined labels")
        if len(set(self.labels)) != len(self.labels) or any(not v.strip() for v in self.labels):
            raise ValueError("Labels must be unique and nonempty")
        if self.task in ("peak", "distress"):
            if self.device != "cpu" or self.quantization != "none":
                raise ValueError("RoBERTa adapters require CPU inference without LLM quantization")
            profile = self.architecture in (
                "EchoE4RobertaMultiHead",
                "XLMRobertaForSequenceClassification",
            )
            if profile:
                expected = (
                    ("peak", "roberta", "echo_e4_safetensors")
                    if self.architecture == "EchoE4RobertaMultiHead"
                    else ("distress", "xlm_roberta", "hf_safetensors")
                )
                if (self.task, self.family, self.export_format) != expected:
                    raise ValueError(
                        "Research classifier profile does not match task/family/export"
                    )
                if not self.inference_spec_file or not self.research_status:
                    raise ValueError(
                        "Research classifiers require a reviewed inference specification and status"
                    )
                if self.calibration.method not in ("uncalibrated", "temperature"):
                    raise ValueError("Research classifier calibration status must be explicit")
                if (
                    self.calibration.semantics == "softmax"
                    and self.preprocessing.aggregation == "max_probabilities"
                ):
                    raise ValueError("Max-window softmax scores are not a class distribution")
                if self.architecture == "XLMRobertaForSequenceClassification" and (
                    self.preprocessing.aggregation != "mean_logits"
                    or self.calibration.method != "temperature"
                    or not self.calibration_file
                ):
                    raise ValueError(
                        "XLM-R distress requires source calibration and mean-logit aggregation"
                    )
            elif self.export_format != "synthetic_fixture" and (
                self.family != "roberta"
                or self.architecture != "RobertaForSequenceClassification"
                or self.export_format != "hf_safetensors"
            ):
                raise ValueError("Classifier architecture must be RoBERTa sequence classification")
            if not profile and (
                self.preprocessing.aggregation != "mean_probabilities"
                or (self.support_mapping and self.support_mapping.score_strategy != "top_class")
            ):
                raise ValueError(
                    "Generic RoBERTa requires mean probabilities and top-class mapping"
                )
            if self.task == "distress" and self.calibration.semantics != "softmax":
                raise ValueError("Only documented single-label five-class distress is supported")
        if self.support_mapping and not set(self.support_mapping.label_flags).issubset(self.labels):
            raise ValueError("Support mapping refers to an unknown trained label")
        if self.support_mapping and (
            self.support_mapping.score_strategy == "max_window_label_probability"
            and self.support_mapping.window_temperature is None
        ):
            raise ValueError("Window support mapping requires an explicitly reviewed temperature")
        if self.task == "phq8" and self.family not in ("sea_lion", "synthetic"):
            raise ValueError("PHQ-8 requires the selected SEA-LION family")
        if self.task == "cbt" and self.family not in ("seallms", "qwen2_cbt", "synthetic"):
            raise ValueError(
                "CBT requires the selected SeaLLMs family; no Qwen export substitution"
            )
        if self.family == "qwen2_cbt" and (
            self.task != "cbt"
            or self.architecture != "Qwen2ForCausalLM"
            or self.export_format != "hf_safetensors"
            or self.device != "cpu"
            or self.quantization != "none"
            or self.compute_dtype != "bfloat16"
            or self.base_model_id is not None
            or self.base_version is not None
            or self.research_status != "provisional_nonfinal"
            or not self.inference_spec_file
            or self.preprocessing.normalization != "identity"
            or self.preprocessing.max_windows != 1
            or self.provenance.get("scope") != "local_fictional_consultation_only"
        ):
            raise ValueError("Full Qwen2 CBT requires its own exact, local fictional CPU profile")
        if (
            self.task in ("phq8", "cbt")
            and self.export_format != "synthetic_fixture"
            and self.family != "qwen2_cbt"
        ):
            if (
                self.export_format != "peft_safetensors"
                or not self.base_model_id
                or not self.base_version
            ):
                raise ValueError("Generation requires an exact compatible base and PEFT adapter")
            if self.device != "cuda":
                raise ValueError("7B/8B generation is supported only in the separate CUDA runtime")
        if self.preprocessing.stride >= self.preprocessing.max_tokens:
            raise ValueError("Stride must be below the sequence limit")
        return self


def confined_file(root: Path, name: str) -> Path:
    if not name or "\\" in name or ":" in name:
        raise ManifestError("INVALID_ARTIFACT_PATH")
    relative = Path(name)
    if relative.is_absolute() or ".." in relative.parts:
        raise ManifestError("INVALID_ARTIFACT_PATH")
    candidate = root / relative
    if root.is_symlink() or root.is_junction() or any(
        (root / Path(*relative.parts[:i])).is_symlink() or (root / Path(*relative.parts[:i])).is_junction()
        for i in range(1, len(relative.parts) + 1)
    ):
        raise ManifestError("SYMLINK_ARTIFACT_REFUSED")
    if not candidate.resolve().is_relative_to(root.resolve()) or not candidate.is_file():
        raise ManifestError("ARTIFACT_MISSING")
    return candidate


def read_manifest(path: Path, synthetic: bool = False, *, hash_file=None) -> ModelManifest:
    if path.is_symlink() or path.stat().st_size > 128_000:
        raise ManifestError("INVALID_MANIFEST")
    manifest = ModelManifest.model_validate_json(path.read_text(encoding="utf-8"))
    if not synthetic and manifest.artifact_kind == "synthetic_engineering":
        raise ManifestError("SYNTHETIC_ARTIFACT_REFUSED")
    if manifest.export_format == "synthetic_fixture":
        if (
            not synthetic
            or manifest.family != "synthetic"
            or manifest.architecture != "EchoSyntheticV1"
        ):
            raise ManifestError("SYNTHETIC_ARTIFACT_REFUSED")
        return manifest
    if manifest.task == "face":
        return manifest  # Readiness stays deferred; never deserialize research pickle exports.
    root = path.parent
    required = set(manifest.files + manifest.tokenizer_files + ["config.json"])
    if manifest.export_format == "echo_e4_safetensors":
        required.discard("config.json")
        required.update(
            {
                "encoder/config.json",
                "encoder/model.safetensors",
                "e4_config.json",
                "heads.safetensors",
            }
        )
    for metadata in (manifest.inference_spec_file, manifest.calibration_file):
        if metadata:
            if metadata not in manifest.files:
                raise ManifestError("UNDECLARED_INFERENCE_METADATA")
            required.add(metadata)
    if manifest.export_format == "peft_safetensors":
        required.discard("config.json")
        required.add("adapter_config.json")
    if (
        manifest.export_format in ("hf_safetensors", "echo_e4_safetensors")
        and not manifest.tokenizer_files
    ):
        raise ManifestError("TOKENIZER_MISSING")
    if manifest.export_format == "hf_safetensors" and not {
        "model.safetensors",
        "model.safetensors.index.json",
    }.intersection(manifest.files):
        raise ManifestError("WEIGHT_INDEX_MISSING")
    if (
        manifest.export_format == "peft_safetensors"
        and "adapter_model.safetensors" not in manifest.files
    ):
        raise ManifestError("LORA_WEIGHTS_MISSING")
    for name in required:
        file = confined_file(root, name)
        if file.suffix in (".bin", ".pt", ".pth", ".pkl", ".pickle", ".py"):
            raise ManifestError("UNTRUSTED_SERIALIZATION_REFUSED")
        expected = manifest.sha256.get(name, "")
        if len(expected) != 64:
            raise ManifestError("CHECKSUM_REQUIRED")
        if hash_file is not None:
            digest = hash_file(file)
        else:
            with file.open("rb") as stream:
                digest = hashlib.file_digest(stream, "sha256").hexdigest()
        if digest != expected:
            raise ManifestError("CHECKSUM_MISMATCH")
    # HF must not discover an undeclared weight shard/tokenizer/config behind the manifest.
    for file in root.rglob("*"):
        if (
            file.is_file()
            and file.name != "manifest.json"
            and file.suffix
            in (
                ".safetensors",
                ".json",
                ".model",
                ".txt",
                ".bin",
                ".pt",
                ".pth",
                ".pickle",
                ".py",
                ".pkl",
            )
        ):
            name = file.relative_to(root).as_posix()
            if name not in required:
                raise ManifestError("UNDECLARED_MODEL_ARTIFACT")
    if manifest.export_format == "hf_safetensors":
        config = json.loads((root / "config.json").read_text())
        if config.get("auto_map") or config.get("architectures") != [manifest.architecture]:
            raise ManifestError("ARCHITECTURE_MISMATCH")
        if manifest.task in ("peak", "distress"):
            actual = config.get("id2label", {})
            if (
                len(actual) != len(manifest.labels)
                or [actual.get(str(i)) for i in range(len(manifest.labels))] != manifest.labels
            ):
                raise ManifestError("LABEL_ORDER_MISMATCH")
            expected_type = "xlm-roberta" if manifest.family == "xlm_roberta" else "roberta"
            if config.get("model_type") != expected_type:
                raise ManifestError("ARCHITECTURE_MISMATCH")
        elif manifest.task == "base":
            if config.get("quantization_config"):
                raise ManifestError("PREQUANTIZED_BASE_UNSUPPORTED")
            expected = {
                "LlamaForCausalLM": "llama",
                "MistralForCausalLM": "mistral",
                "Qwen2ForCausalLM": "qwen2",
            }
            if expected.get(manifest.architecture) != config.get("model_type"):
                raise ManifestError("UNSUPPORTED_BASE_ARCHITECTURE")
    if not any(name.endswith(".safetensors") for name in manifest.files):
        raise ManifestError("SAFETENSORS_REQUIRED")
    for name in required:
        if name.endswith(".index.json"):
            index = json.loads((root / name).read_text())
            if not index.get("weight_map") or not set(
                index.get("weight_map", {}).values()
            ).issubset(required):
                raise ManifestError("UNDECLARED_WEIGHT_SHARD")
    if manifest.export_format == "peft_safetensors":
        adapter = json.loads((root / "adapter_config.json").read_text())
        if (
            adapter.get("peft_type") != "LORA"
            or adapter.get("task_type") != "CAUSAL_LM"
            or adapter.get("base_model_name_or_path") != manifest.base_model_id
            or adapter.get("auto_mapping")
            or not adapter.get("target_modules")
        ):
            raise ManifestError("INVALID_LORA_ADAPTER")
    if manifest.architecture in ("EchoE4RobertaMultiHead", "XLMRobertaForSequenceClassification"):
        from app.model.research_profiles import read_inference_spec

        read_inference_spec(root, manifest)
    return manifest
