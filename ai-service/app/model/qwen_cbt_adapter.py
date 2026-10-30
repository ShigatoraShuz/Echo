"""Full Qwen2 export under its own identity, confined to fictional local consultation.

No PEFT substitution, random missing layers, pickle, external base or clinical claim.
CPU weights are released between requests so the classifier can share limited RAM.
"""

import gc
import json
import time

from app.model.manifest import ManifestError, confined_file
from app.model.research_adapters import verify_tensors
from app.safety.urgent_language import has_urgent_language


class QwenCbtAdapter:
    def __init__(self, root, manifest, threads):
        self.root, self.manifest, self.threads = root, manifest, threads
        self.config_data = json.loads(confined_file(root, "config.json").read_text(encoding="utf8"))
        self.spec = json.loads(
            confined_file(root, manifest.inference_spec_file).read_text(encoding="utf8")
        )
        config = self.config_data
        if (
            config.get("architectures") != ["Qwen2ForCausalLM"]
            or config.get("model_type") != "qwen2"
            or config.get("auto_map")
            or config.get("quantization_config")
            or not 1 <= config.get("num_hidden_layers", 0) <= 32
            or not 1 <= config.get("hidden_size", 0) <= 2048
            or not 1 <= config.get("vocab_size", 0) <= 200000
            or not config.get("tie_word_embeddings")
        ):
            raise ManifestError("UNSUPPORTED_FULL_QWEN_PROFILE")
        if (
            self.spec.get("schema_version") != "echo-qwen-cbt-inference-v1"
            or self.spec.get("scope") != "local_fictional_consultation_only"
            or self.spec.get("training_reference_parity_verified") is not False
            or self.spec.get("sampling") != "greedy"
            or not 8 <= self.spec.get("max_new_tokens", 0) <= 96
            or not 1 <= self.spec.get("max_time_seconds", 0) <= 30
            or not isinstance(self.spec.get("system_prompt"), str)
            or not 50 <= len(self.spec["system_prompt"]) <= 2000
        ):
            raise ManifestError("INVALID_QWEN_GENERATION_SPEC")
        # Transformers 5 exports nested RoPE parameters; preserve their exact
        # default-RoPE theta when loading with the installed 4.x implementation.
        rope = config.get("rope_parameters")
        if rope and (
            rope.get("rope_type") != "default" or set(rope) != {"rope_type", "rope_theta"}
        ):
            raise ManifestError("UNVERIFIED_QWEN_ROPE_PROFILE")
        self.tokenizer = None

    def _load_tokenizer(self):
        from transformers import AutoTokenizer

        config = json.loads(
            confined_file(self.root, "tokenizer_config.json").read_text(encoding="utf8")
        )
        extra = config.get("extra_special_tokens")
        options = {}
        if isinstance(extra, list):
            # Transformers 5 stores these as a list; 4.x expects a named-token
            # dictionary. Preserve the existing backend tokens, without adding IDs.
            if not extra or any(not isinstance(token, str) for token in extra):
                raise ManifestError("UNVERIFIED_QWEN_SPECIAL_TOKENS")
            options = {"extra_special_tokens": {}, "additional_special_tokens": extra}
        tokenizer = AutoTokenizer.from_pretrained(
            str(self.root), local_files_only=True, trust_remote_code=False, use_fast=True, **options
        )
        if isinstance(extra, list):
            backend = json.loads(
                confined_file(self.root, "tokenizer.json").read_text(encoding="utf8")
            )
            declared = {token["content"]: token["id"] for token in backend.get("added_tokens", [])}
            if any(
                token not in declared or tokenizer.convert_tokens_to_ids(token) != declared[token]
                for token in extra
            ):
                raise ManifestError("QWEN_SPECIAL_TOKEN_ID_MISMATCH")
        return tokenizer

    def _load_model(self):
        import torch
        from safetensors import safe_open
        from safetensors.torch import load_file
        from transformers import Qwen2Config, Qwen2ForCausalLM
        from transformers.modeling_rope_utils import ROPE_INIT_FUNCTIONS

        config_data = dict(self.config_data)
        rope = config_data.pop("rope_parameters", None)
        if rope:
            config_data["rope_theta"] = rope["rope_theta"]
        config = Qwen2Config(**config_data)
        config._attn_implementation = "eager"
        with torch.device("meta"):
            model = Qwen2ForCausalLM(config).to(torch.bfloat16)
        expected = dict(model.state_dict())
        with safe_open(
            str(self.root / "model.safetensors"), framework="pt", device="cpu"
        ) as archive:
            keys = set(archive.keys())
            if any(archive.get_slice(key).get_dtype() != "BF16" for key in keys):
                raise ManifestError("QWEN_DTYPE_MISMATCH")
        tied_omitted = "lm_head.weight" not in keys
        if tied_omitted:
            # HF safely omits this alias only for the explicitly tied architecture.
            if not config.tie_word_embeddings or "model.embed_tokens.weight" not in keys:
                raise ManifestError("QWEN_TIED_EMBEDDING_MISSING")
            expected.pop("lm_head.weight", None)
        if sum(t.numel() for t in expected.values()) > 2_000_000_000:
            raise ManifestError("QWEN_CPU_PARAMETER_BUDGET")
        verify_tensors(self.root, ["model.safetensors"], expected)
        weights = load_file(self.root / "model.safetensors", device="cpu")
        if tied_omitted:
            weights["lm_head.weight"] = weights["model.embed_tokens.weight"]
        model.load_state_dict(weights, strict=True, assign=True)
        model.tie_weights()
        for name, buffer in list(model.named_buffers()):
            if buffer.is_meta:
                if name != "model.rotary_emb.inv_freq":
                    raise ManifestError("QWEN_UNINITIALIZED_BUFFER")
                inv_freq, scale = ROPE_INIT_FUNCTIONS["default"](config, device=torch.device("cpu"))
                model.model.rotary_emb.register_buffer("inv_freq", inv_freq, persistent=False)
                model.model.rotary_emb.original_inv_freq = inv_freq
                model.model.rotary_emb.attention_scaling = scale
        if any(p.is_meta or p.device.type != "cpu" for p in model.parameters()):
            raise ManifestError("QWEN_INCOMPLETE_PARAMETERS")
        return model.eval()

    def generate(self, text, context, requested_max_tokens):
        import torch
        from transformers import GenerationConfig

        torch.set_num_threads(self.threads)
        started = time.perf_counter()
        if self.tokenizer is None:
            self.tokenizer = self._load_tokenizer()
        tokenizer = self.tokenizer
        if not tokenizer.chat_template or type(tokenizer).__name__ != "Qwen2TokenizerFast":
            raise ManifestError("QWEN_TOKENIZER_OR_TEMPLATE_MISSING")
        if (
            len(tokenizer) > self.config_data["vocab_size"]
            or tokenizer.eos_token_id != self.config_data["eos_token_id"]
        ):
            raise ManifestError("QWEN_TOKENIZER_MISMATCH")
        messages = [
            {"role": "system", "content": self.spec["system_prompt"]},
            *context[-6:],
            {"role": "user", "content": text},
        ]
        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        encoded = tokenizer(prompt, return_tensors="pt", add_special_tokens=False)
        if encoded.input_ids.shape[1] > self.manifest.preprocessing.max_tokens:
            raise ManifestError("INPUT_TOKEN_LIMIT")
        model = self._load_model()
        loaded_ms = round((time.perf_counter() - started) * 1000)
        try:
            with torch.inference_mode():
                verified_logits = model(**encoded, use_cache=False, logits_to_keep=1).logits
            if (
                list(verified_logits.shape) != [1, 1, model.config.vocab_size]
                or not torch.isfinite(verified_logits).all()
            ):
                raise ManifestError("QWEN_NONFINITE_FORWARD")
            forward_shape = list(verified_logits.shape)
            del verified_logits
            limits = GenerationConfig.from_model_config(model.config)
            limits.do_sample = False
            limits.pad_token_id = tokenizer.pad_token_id
            source = json.loads(
                confined_file(self.root, "generation_config.json").read_text(encoding="utf8")
            )
            limits.eos_token_id = source["eos_token_id"]
            if not isinstance(limits.eos_token_id, list) or any(
                not isinstance(v, int) or v < 0 or v >= model.config.vocab_size
                for v in limits.eos_token_id
            ):
                raise ManifestError("QWEN_STOP_TOKEN_MISMATCH")
            begin = time.perf_counter()
            with torch.inference_mode():
                output = model.generate(
                    **encoded,
                    generation_config=limits,
                    max_new_tokens=min(requested_max_tokens, self.spec["max_new_tokens"]),
                    max_time=self.spec["max_time_seconds"],
                    use_cache=True,
                )
            new_ids = output[0, encoded.input_ids.shape[1] :]
            reply = tokenizer.decode(new_ids, skip_special_tokens=True).strip()
            if not reply or len(reply) > 6000 or has_urgent_language(reply):
                raise ManifestError("QWEN_OUTPUT_NOT_DISPLAYABLE")
            self.last_diagnostics = {
                "strict_weights_loaded": True,
                "device": "cpu",
                "dtype": "bfloat16",
                "forward_shape": forward_shape,
                "forward_finite": True,
                "prompt_tokens": int(encoded.input_ids.shape[1]),
                "new_tokens": len(new_ids),
                "validation_load_ms": loaded_ms,
                "generation_ms": round((time.perf_counter() - begin) * 1000),
                "training_parity_verified": False,
            }
            return {
                "text": reply,
                "disclaimer": f"REAL_PROVISIONAL_MODEL: {self.manifest.model_id}@{self.manifest.version}. Unvalidated research generation; not SeaLLMs, clinical advice or therapy. CPU load {loaded_ms} ms; generation {round((time.perf_counter() - begin) * 1000)} ms; {len(new_ids)} output tokens.",
            }
        finally:
            del model
            gc.collect()
