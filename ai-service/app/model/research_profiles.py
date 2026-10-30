"""Explicit, data-only research recipes. Archive names never select a forward pass.

The audited archives do not establish every field below. An operator must supply the
matching training-source/researcher-confirmed recipe; no recipe is manufactured here.
"""

import hashlib
import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.model.manifest import ManifestError, confined_file

E4_ARCHITECTURE = "EchoE4RobertaMultiHead"
XLMR_ARCHITECTURE = "XLMRobertaForSequenceClassification"


class InferenceSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal["echo-research-inference-v1"]
    architecture: Literal["EchoE4RobertaMultiHead", "XLMRobertaForSequenceClassification"]
    verification: Literal["training_source_reviewed", "researcher_confirmed"]
    source_reference: str = Field(min_length=10, max_length=500)
    evidence_files: list[str] = Field(min_length=1, max_length=10)
    normalization: Literal["identity", "unicode_nfc"]
    max_tokens: int = Field(ge=8, le=8192)
    stride: int = Field(ge=0, le=8192)
    stride_semantics: Literal["overlap_tokens", "step_tokens"]
    special_tokens: Literal["tokenizer_defined_per_window"]
    window_weighting: Literal["uniform"]
    aggregation: Literal["mean_logits", "mean_probabilities", "max_probabilities"]
    batch_size: int = Field(ge=1, le=8)
    padding_side: Literal["right"]
    truncation_side: Literal["right"]
    empty_input: Literal["reject"]
    # No default pooling, activation, labels, calibration or guessed tensor layout.
    pooling: Literal["cls_token", "masked_mean", "pooler_output"] | None
    head_kind: Literal["linear"] | None
    encoder_pooler: bool | None
    heads: dict[str, list[str]] | None
    support_flag_temperature: float | None = Field(default=None, gt=0, le=100)


def json_artifact(root: Path, name: str):
    path = confined_file(root, name)
    if path.stat().st_size > 128_000:
        raise ManifestError("INFERENCE_METADATA_TOO_LARGE")
    try:
        value = json.loads(path.read_text(encoding="utf8"))
        if not isinstance(value, dict):
            raise TypeError("Object required")
        return value
    except (ValueError, TypeError, UnicodeError) as error:
        raise ManifestError("INVALID_INFERENCE_METADATA") from error


def read_inference_spec(root, manifest):
    if not manifest.inference_spec_file:
        raise ManifestError("RESEARCH_INFERENCE_SPEC_REQUIRED")
    try:
        spec = InferenceSpec.model_validate(json_artifact(root, manifest.inference_spec_file))
    except ValidationError as error:
        raise ManifestError("INVALID_RESEARCH_INFERENCE_SPEC") from error
    p = manifest.preprocessing
    if spec.architecture != manifest.architecture or (
        spec.normalization,
        spec.max_tokens,
        spec.stride,
        spec.aggregation,
    ) != (p.normalization, p.max_tokens, p.stride, p.aggregation):
        raise ManifestError("INFERENCE_SPEC_MANIFEST_MISMATCH")
    for name in spec.evidence_files:
        if name not in manifest.files or name == manifest.inference_spec_file:
            raise ManifestError("INFERENCE_SOURCE_EVIDENCE_REQUIRED")
        path = confined_file(root, name)
        with path.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != manifest.sha256.get(name):
                raise ManifestError("CHECKSUM_MISMATCH")
    if spec.architecture == E4_ARCHITECTURE:
        if (
            spec.head_kind != "linear"
            or spec.pooling is None
            or spec.encoder_pooler is None
            or (spec.pooling == "pooler_output" and not spec.encoder_pooler)
        ):
            raise ManifestError("E4_FORWARD_SPEC_REQUIRED")
        e4 = json_artifact(root, "e4_config.json")
        expected = {"plutchik": e4.get("plutchik_labels")}
        if e4.get("has_trained_go_aux_head"):
            expected["goemotions"] = e4.get("goemotions_labels")
        if (
            spec.heads != expected
            or manifest.labels != expected["plutchik"]
            or len(manifest.labels) != 8
            or any(not labels or len(set(labels)) != len(labels) for labels in expected.values())
        ):
            raise ManifestError("E4_HEAD_LABEL_MISMATCH")
        config = json_artifact(root, "encoder/config.json")
        if (
            config.get("auto_map")
            or config.get("architectures") != ["RobertaModel"]
            or config.get("model_type") != "roberta"
        ):
            raise ManifestError("ARCHITECTURE_MISMATCH")
        if manifest.calibration.method == "temperature" and not manifest.calibration_file:
            raise ManifestError("SOURCE_CALIBRATION_REQUIRED")
    elif any(
        value is not None
        for value in (spec.head_kind, spec.pooling, spec.encoder_pooler, spec.heads)
    ):
        raise ManifestError("XLMR_FORWARD_SPEC_MISMATCH")
    if manifest.calibration_file:
        calibration = json_artifact(root, manifest.calibration_file)
        if (
            calibration.get("class_order") != manifest.labels
            or calibration.get("temperature") != manifest.calibration.temperature
        ):
            raise ManifestError("CALIBRATION_LABEL_OR_TEMPERATURE_MISMATCH")
        if spec.architecture == XLMR_ARCHITECTURE:
            if (
                calibration.get("schema") != "ECHO_XLMR_V2_WINDOW_CALIBRATED"
                or calibration.get("aggregation") != "softmax(mean_window_logits / temperature)"
                or calibration.get("stride") != spec.stride
            ):
                raise ManifestError("CALIBRATION_RECIPE_MISMATCH")
            for key, filename in (
                ("model_config_sha256", "config.json"),
                ("model_weights_sha256", "model.safetensors"),
            ):
                if calibration.get(key) != manifest.sha256.get(filename):
                    raise ManifestError("CALIBRATION_CHECKPOINT_MISMATCH")
            mapping = manifest.support_mapping
            if mapping and (
                calibration.get("flag_score") != "max_window_softmax_suicidal_label"
                or mapping.score_strategy != "max_window_label_probability"
                or set(mapping.label_flags) != {"Suicidal"}
                or mapping.minimum_probability
                != calibration.get("suicidal_label_flag", {}).get("threshold")
                or spec.support_flag_temperature is None
                or mapping.window_temperature != spec.support_flag_temperature
            ):
                raise ManifestError("SOURCE_SUPPORT_MAPPING_MISMATCH")
    return spec
