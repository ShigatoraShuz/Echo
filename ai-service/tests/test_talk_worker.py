import base64
from types import SimpleNamespace

import numpy as np
import pytest

from app.talk_worker import Speech


def bare():
    speech = Speech.__new__(Speech)
    speech.np = np
    speech.torch = None
    speech.whisper_provenance = {"providerName": "synthetic"}
    return speech


@pytest.mark.parametrize(
    "encoded",
    [
        "invalid!",
        base64.b64encode(b"a").decode(),
        base64.b64encode(b"a" * (60 * 16000 * 2 + 2)).decode(),
    ],
    ids=["invalid-base64", "odd-pcm", "oversized-pcm"],
)
def test_pcm_rejects_malformed_or_oversized_input(encoded):
    with pytest.raises(ValueError):
        bare().run({"task": "transcribe", "audio": encoded})


def test_silence_does_not_invoke_transcription():
    assert (
        bare().run({"task": "transcribe", "audio": base64.b64encode(bytes(32000)).decode()})["text"]
        == ""
    )


def test_voice_rejects_normalization_that_drops_approved_words():
    speech = bare()
    speech.voices = {
        "eng": (SimpleNamespace(prepare_for_tokenization=lambda text: ("hello", {})), None)
    }
    with pytest.raises(ValueError, match="omit content"):
        speech.run({"task": "speak", "text": "hello 123", "language": "eng"})


def test_transcript_length_is_bounded():
    speech = bare()
    speech.whisper = SimpleNamespace(
        transcribe=lambda *args, **kwargs: (
            [SimpleNamespace(text="x" * 4001, no_speech_prob=0)],
            SimpleNamespace(language="en"),
        )
    )
    pcm = np.full(32000, 1000, dtype="<i2").tobytes()
    with pytest.raises(ValueError, match="limit"):
        speech.run({"task": "transcribe", "audio": base64.b64encode(pcm).decode()})
