import io

import numpy as np
import pytest

sf = pytest.importorskip("soundfile")
from app.speech_worker import decode_recording


def wav(seconds):
    buffer = io.BytesIO()
    sf.write(buffer, np.zeros((seconds * 16000, 2), dtype=np.float32), 16000, format="WAV")
    return buffer.getvalue()


def test_audio_duration_and_formats_are_bounded():
    assert len(decode_recording(wav(1))) > 15000
    with pytest.raises(__import__("av").error.InvalidDataError):
        decode_recording(b"not an audio file")
    with pytest.raises(ValueError):
        decode_recording(b"x" * (10 * 1024 * 1024 + 1))
    with pytest.raises(ValueError):
        decode_recording(wav(61))


def test_silence_produces_no_transcript_without_loading_whisper(monkeypatch, tmp_path):
    import base64

    import faster_whisper
    import torch

    from app.speech_worker import run

    monkeypatch.setattr(torch.cuda, "reset_peak_memory_stats", lambda: None)

    def forbidden(*args, **kwargs):
        raise AssertionError("Silence must not load a transcription model")

    monkeypatch.setattr(faster_whisper, "WhisperModel", forbidden)
    result = run(tmp_path, {"task": "transcribe", "audio": base64.b64encode(wav(1)).decode()})
    assert result == {"text": ""}
