"""Separate research adapters; no downloads, pickle loading or inferred E4 recipe.

These implement explicitly supplied recipes, not a claim that the currently missing
E4 training source or XLM-R window semantics have been independently confirmed.
"""

import math
import unicodedata

from app.model.adapters import verify_loading_info
from app.model.manifest import ManifestError
from app.model.research_profiles import E4_ARCHITECTURE, read_inference_spec


def verify_tensors(root, filenames, expected):
    from safetensors import safe_open

    actual = {}
    for name in filenames:
        with safe_open(str(root / name), framework="pt", device="cpu") as tensors:
            for key in sorted(tensors.keys()):
                if key in actual:
                    raise ManifestError("CHECKPOINT_PARAMETERS_UNEXPECTED")
                tensor = tensors.get_slice(key)
                if tensor.get_dtype() not in ("F32", "F16", "BF16"):
                    raise ManifestError("CHECKPOINT_DTYPE_UNSUPPORTED")
                actual[key] = tuple(tensor.get_shape())
    if set(actual) != set(expected) or any(
        actual[key] != tuple(value.shape) for key, value in expected.items() if key in actual
    ):
        raise ManifestError("CHECKPOINT_PARAMETERS_MISSING_OR_MISMATCHED")


def aggregate_logits(logits, manifest):
    """Keep class calibration and the independently documented flag score separate."""
    import torch

    if logits.ndim != 2 or not len(logits) or logits.shape[1] != len(manifest.labels):
        raise ManifestError("INVALID_CLASSIFIER_OUTPUT")
    logits = logits.float()
    if not torch.isfinite(logits).all():
        raise ManifestError("INVALID_CLASSIFIER_OUTPUT")
    temperature = manifest.calibration.temperature
    activate = torch.softmax if manifest.calibration.semantics == "softmax" else torch.sigmoid

    def probabilities(values, scale):
        return (
            activate(values / scale, dim=-1)
            if activate is torch.softmax
            else activate(values / scale)
        )

    method = manifest.preprocessing.aggregation
    if method == "mean_logits":
        scores = probabilities(logits.mean(0), temperature)
    else:
        per_window = probabilities(logits, temperature)
        scores = per_window.mean(0) if method == "mean_probabilities" else per_window.max(0).values
    values = scores.tolist()
    if not all(math.isfinite(value) and 0 <= value <= 1 for value in values):
        raise ManifestError("INVALID_CLASSIFIER_OUTPUT")
    items = [
        {"label": label, "probability": value}
        for label, value in zip(manifest.labels, values, strict=True)
    ]
    ranked = sorted(items, key=lambda item: item["probability"], reverse=True)
    flags = None
    mapping = manifest.support_mapping
    if mapping:
        if mapping.score_strategy == "max_window_label_probability":
            window_scores = probabilities(logits, mapping.window_temperature).max(0).values.tolist()
            flags = sorted(
                {
                    flag
                    for label, value in zip(manifest.labels, window_scores, strict=True)
                    if value >= mapping.minimum_probability
                    for flag in mapping.label_flags.get(label, [])
                }
            )
        else:
            flags = (
                mapping.label_flags.get(ranked[0]["label"], [])
                if ranked[0]["probability"] >= mapping.minimum_probability
                else []
            )
    return {
        "scores": items,
        "topFive": ranked[:5],
        "semantics": manifest.calibration.semantics,
        "calibration": manifest.calibration.documentation[:1700]
        + " Provisional research engineering output; not clinically validated. Label scores do not establish diagnosis, severity or safety.",
        "supportFlags": flags,
        "supportMappingReference": mapping.approved_reference if mapping else None,
    }


def token_windows(tokenizer, text, spec, preprocessing):
    if not text.strip():
        raise ManifestError("EMPTY_MODEL_INPUT")
    if len(text) > 20_000:
        raise ManifestError("INPUT_TOKEN_LIMIT")
    if spec.normalization == "unicode_nfc":
        text = unicodedata.normalize("NFC", text)
    ids = tokenizer(text, add_special_tokens=False, truncation=False)["input_ids"]
    usable = spec.max_tokens - tokenizer.num_special_tokens_to_add(pair=False)
    step = usable - spec.stride if spec.stride_semantics == "overlap_tokens" else spec.stride
    if usable <= 0 or step <= 0 or step > usable:
        raise ManifestError("INVALID_WINDOW_SPEC")
    windows = []
    for start in range(0, max(1, len(ids)), step):
        end = min(start + usable, len(ids))
        windows.append(
            tokenizer.prepare_for_model(
                ids[start:end], add_special_tokens=True, return_attention_mask=True
            )
        )
        if len(windows) > preprocessing.max_windows:
            if preprocessing.truncation == "reject":
                raise ManifestError("INPUT_TOKEN_LIMIT")
            return windows[: preprocessing.max_windows], True
        if end == len(ids):
            break
    return windows, False


def validate_tokenizer(tokenizer, config, spec, names):
    if tokenizer.__class__.__name__ not in names or not tokenizer.is_fast:
        raise ManifestError("TOKENIZER_ARCHITECTURE_MISMATCH")
    if len(tokenizer) != config.vocab_size or any(
        getattr(tokenizer, name) != getattr(config, name)
        for name in ("bos_token_id", "eos_token_id", "pad_token_id")
    ):
        raise ManifestError("TOKENIZER_MODEL_MISMATCH")
    if spec.max_tokens > min(tokenizer.model_max_length, config.max_position_embeddings - 2):
        raise ManifestError("SEQUENCE_LIMIT_MISMATCH")
    tokenizer.padding_side = spec.padding_side
    tokenizer.truncation_side = spec.truncation_side


class ResearchClassifierAdapter:
    def window_logits(self, text):
        import torch

        windows, truncated = token_windows(
            self.tokenizer, text, self.spec, self.manifest.preprocessing
        )
        logits = []
        with torch.inference_mode():
            for start in range(0, len(windows), self.spec.batch_size):
                batch = self.tokenizer.pad(
                    windows[start : start + self.spec.batch_size], return_tensors="pt"
                )
                logits.append(self.forward(batch).float().cpu())
        return torch.cat(logits), truncated

    def infer(self, text):
        logits, truncated = self.window_logits(text)
        return aggregate_logits(logits, self.manifest) | {
            "windowsProcessed": len(logits),
            "truncated": truncated,
        }


class XlmRobertaDistressAdapter(ResearchClassifierAdapter):
    def __init__(self, root, manifest, cpu_threads=2):
        import torch
        from transformers import (
            AutoTokenizer,
            XLMRobertaConfig,
            XLMRobertaForSequenceClassification,
        )

        self.spec = read_inference_spec(root, manifest)
        self.manifest = manifest
        torch.set_num_threads(cpu_threads)
        self.tokenizer = AutoTokenizer.from_pretrained(
            str(root), local_files_only=True, trust_remote_code=False
        )
        config = XLMRobertaConfig.from_pretrained(str(root), local_files_only=True)
        validate_tokenizer(self.tokenizer, config, self.spec, ("XLMRobertaTokenizerFast",))
        with torch.device("meta"):
            shape_model = XLMRobertaForSequenceClassification(config)
        verify_tensors(
            root,
            [name for name in manifest.files if name.endswith(".safetensors")],
            shape_model.state_dict(),
        )
        del shape_model
        model, info = XLMRobertaForSequenceClassification.from_pretrained(
            str(root), local_files_only=True, use_safetensors=True, output_loading_info=True
        )
        verify_loading_info(info)
        self.model = model.to("cpu").eval()

    def forward(self, batch):
        return self.model(**batch).logits


class E4EmotionAdapter(ResearchClassifierAdapter):
    """Reviewed linear-head recipe only. Other E4 computations require an explicit extension."""

    def __init__(self, root, manifest, cpu_threads=2):
        import torch
        from safetensors.torch import load_file
        from transformers import AutoTokenizer, RobertaConfig, RobertaModel

        self.spec = read_inference_spec(root, manifest)
        if self.spec.architecture != E4_ARCHITECTURE:
            raise ManifestError("ARCHITECTURE_MISMATCH")
        self.manifest = manifest
        torch.set_num_threads(cpu_threads)
        config = RobertaConfig.from_pretrained(str(root / "encoder"), local_files_only=True)
        self.tokenizer = AutoTokenizer.from_pretrained(
            str(root), local_files_only=True, trust_remote_code=False
        )
        validate_tokenizer(self.tokenizer, config, self.spec, ("RobertaTokenizerFast",))
        with torch.device("meta"):
            shape_encoder = RobertaModel(config, add_pooling_layer=self.spec.encoder_pooler)
            shape_heads = torch.nn.ModuleDict(
                {
                    name: torch.nn.Linear(config.hidden_size, len(labels))
                    for name, labels in self.spec.heads.items()
                }
            )
        verify_tensors(
            root,
            [
                name
                for name in manifest.files
                if name.startswith("encoder/") and name.endswith(".safetensors")
            ],
            shape_encoder.state_dict(),
        )
        verify_tensors(root, ["heads.safetensors"], shape_heads.state_dict())
        del shape_encoder, shape_heads
        encoder, info = RobertaModel.from_pretrained(
            str(root / "encoder"),
            add_pooling_layer=self.spec.encoder_pooler,
            local_files_only=True,
            use_safetensors=True,
            output_loading_info=True,
        )
        verify_loading_info(info)
        self.encoder = encoder.to("cpu").eval()
        self.heads = torch.nn.ModuleDict(
            {
                name: torch.nn.Linear(config.hidden_size, len(labels))
                for name, labels in self.spec.heads.items()
            }
        )
        self.heads.load_state_dict(
            load_file(str(root / "heads.safetensors"), device="cpu"), strict=True
        )
        self.heads.eval()

    def forward(self, batch):
        output = self.encoder(**batch)
        if self.spec.pooling == "cls_token":
            features = output.last_hidden_state[:, 0]
        elif self.spec.pooling == "masked_mean":
            mask = batch["attention_mask"].unsqueeze(-1)
            features = (output.last_hidden_state * mask).sum(1) / mask.sum(1).clamp(min=1)
        else:
            features = output.pooler_output
        return self.heads["plutchik"](features)
