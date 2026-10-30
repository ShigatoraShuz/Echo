# Local speech environment

Environment: E:\Python Project\CODEX\speech-venv
Python executable: speech-venv\Scripts\python.exe

Installed speech dependencies and their resolved transitive dependencies are recorded in ai-service/requirements-speech.lock. Main packages: faster-whisper 1.2.1, CTranslate2 4.8.4, torch 2.11.0+cu130, torchaudio 2.11.0+cu130, transformers 5.5.0, accelerate 1.15.0, soundfile 0.14.0, librosa 1.0.0, einops 0.8.2, and av 19.0.2.

The initial PyPI installation selected CPU Torch. It was replaced with the matching CUDA 13 Torch/Torchaudio pair from https://download.pytorch.org/whl/cu130. All package downloads and temporary files were kept inside CODEX/runtime-cache. No global installation or changes to Thesis2_VENV were made. No additional model weights were downloaded.

Verification: pip check passed; all direct speech-package imports passed; Torch detected RTX 5070 Ti and executed a CUDA tensor calculation; CTranslate2 detected one CUDA device. The existing local Whisper snapshot completed GPU inference on one second of synthetic silence. It emitted one segment, so this smoke test does not validate silence rejection or transcription accuracy. Production silence handling still needs testing.

MOSS inference, default-voice generation, audio cleanup, coordinated GPU scheduling and Buddy Chat/Talk application integration remain unverified or unfinished. Installing this environment does not complete those application features.

Use this environment explicitly when running speech code. Keep model loading offline and use only existing CODEX/models/voice assets, never cloned/reference voices.
