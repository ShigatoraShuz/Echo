"""Persistent, offline Whisper/MMS worker. Protocol goes to stdout, never logs inputs."""

import base64
import contextlib
import hashlib
import json
import os
import sys
from pathlib import Path

os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1")


class Speech:
    def __init__(self, root, device):
        import numpy as np
        import torch
        from faster_whisper import WhisperModel
        from transformers import AutoTokenizer, VitsModel

        self.np, self.torch = np, torch
        self.root = Path(root)
        manifest = json.loads((self.root / "realtime/manifest.json").read_text("utf-8"))
        for entry in manifest["models"]:
            for item in entry["files"]:
                file = (self.root / "realtime" / item["path"]).resolve()
                if (
                    not file.is_relative_to((self.root / "realtime").resolve())
                    or hashlib.sha256(file.read_bytes()).hexdigest() != item["sha256"]
                ):
                    raise ValueError("Voice integrity failure")
        torch.set_num_threads(min(4, os.cpu_count() or 1))
        whisper_files = [
            item
            for item in json.loads((self.root / "manifest.json").read_text("utf-8"))
            if item["path"].replace("\\", "/").startswith("voice/whisper/")
        ]
        if not whisper_files:
            raise ValueError("Missing Whisper provenance")
        for item in whisper_files:
            file = (self.root.parent / item["path"]).resolve()
            if (
                not file.is_relative_to((self.root / "whisper").resolve())
                or file.stat().st_size != item["size"]
                or hashlib.sha256(file.read_bytes()).hexdigest() != item["sha256"]
            ):
                raise ValueError("Whisper integrity failure")
        self.whisper = WhisperModel(
            str(self.root / "whisper"),
            device=device,
            compute_type="float16" if device == "cuda" else "int8",
            local_files_only=True,
            cpu_threads=4,
        )
        self.voices = {}
        for language in ["eng", "tgl"]:
            folder = self.root / "realtime" / language
            self.voices[language] = (
                AutoTokenizer.from_pretrained(folder, local_files_only=True),
                VitsModel.from_pretrained(folder, local_files_only=True).eval(),
            )
        self.provenance = {
            "providerName": "local-mms-base-voice",
            "modelVersion": hashlib.sha256(
                (self.root / "realtime/manifest.json").read_bytes()
            ).hexdigest(),
            "inferenceVersion": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "voice": "language-specific base; no reference or cloning",
            "license": "CC-BY-NC-4.0",
            "whisperDevice": device,
        }

        self.whisper_provenance = {
            k: v for k, v in self.provenance.items() if k not in {"license", "voice"}
        }
        self.whisper_provenance.update(
            providerName="local-faster-whisper",
            modelVersion=hashlib.sha256(
                json.dumps(whisper_files, sort_keys=True).encode()
            ).hexdigest(),
        )
        self.voice_entries = {entry["language"]: entry for entry in manifest["models"]}
        warm = self.run({"task": "speak", "language": "eng", "text": "Hello."})
        self.run({"task": "speak", "language": "tgl", "text": "Kumusta."})
        self.run({"task": "transcribe", "audio": warm["audio"]})

    def run(self, request):
        np, torch = self.np, self.torch
        if request["task"] == "transcribe":
            data = base64.b64decode(request["audio"], validate=True)
            if len(data) > 60 * 16000 * 2 or len(data) % 2:
                raise ValueError("Invalid PCM")
            samples = np.frombuffer(data, dtype="<i2").astype(np.float32) / 32768
            if len(samples) < 1600 or np.max(np.abs(samples), initial=0) < 0.005:
                return {"text": "", "model": self.whisper_provenance}
            segments, info = self.whisper.transcribe(
                samples, beam_size=1, condition_on_previous_text=False, vad_filter=True
            )
            text = " ".join(s.text.strip() for s in segments if s.no_speech_prob < 0.6).strip()
            if len(text) > 4000:
                raise ValueError("Transcript exceeds limit")
            return {"text": text, "language": info.language, "model": self.whisper_provenance}
        if request["task"] == "speak":
            language = request.get("language", "eng")
            text = request["text"]
            if language not in self.voices or not text.strip() or len(text) > 280:
                raise ValueError("Invalid phrase")
            tokenizer, model = self.voices[language]
            normalized = tokenizer.prepare_for_tokenization(text)[0]
            letters = lambda value: "".join(c for c in value.casefold() if c.isalnum())
            if letters(normalized) != letters(text):
                raise ValueError("Voice normalization would omit content")
            inputs = tokenizer(text, return_tensors="pt")
            # Unknown vocabulary must be explicit rather than silently dropping the reply.
            if (
                tokenizer.unk_token_id is not None
                and (inputs["input_ids"] == tokenizer.unk_token_id).any()
            ):
                raise ValueError("Unsupported voice vocabulary")
            with torch.inference_mode():
                wave = model(**inputs).waveform[0].float().numpy()
            if (
                not len(wave)
                or np.max(np.abs(wave), initial=0) < 0.00001
                or not np.isfinite(wave).all()
                or len(wave) > model.config.sampling_rate * 45
            ):
                raise ValueError("Invalid speech")
            pcm = (np.clip(wave, -1, 1) * 32767).astype("<i2").tobytes()
            return {
                "audio": base64.b64encode(pcm).decode(),
                "sampleRate": model.config.sampling_rate,
                "language": language,
                "model": {
                    **self.provenance,
                    "language": language,
                    "revision": self.voice_entries[language]["revision"],
                    "modelVersion": hashlib.sha256(
                        json.dumps(self.voice_entries[language], sort_keys=True).encode()
                    ).hexdigest(),
                },
            }
        if request["task"] == "ready":
            return {"ready": True, "model": self.provenance}
        raise ValueError("Unknown task")


if __name__ == "__main__":
    with contextlib.redirect_stdout(sys.stderr):
        speech = Speech(Path(sys.argv[1]), sys.argv[2])
    for line in sys.stdin:
        try:
            request = json.loads(line)
            with contextlib.redirect_stdout(sys.stderr):
                result = speech.run(request)
            result = {"id": request["id"], "result": result}
        except Exception:  # noqa: BLE001 -- sanitize loader errors; never expose audio, text, or local paths
            result = {
                "id": request.get("id") if "request" in locals() else None,
                "error": "LOCAL_SPEECH_UNAVAILABLE",
            }
        sys.stdout.write(json.dumps(result, allow_nan=False) + "\n")
        sys.stdout.flush()
