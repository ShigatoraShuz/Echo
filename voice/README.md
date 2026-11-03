# Buddy voice implementation — MOSS Nano

Standalone local prototype on port 8766: microphone → CPU Whisper → mixed_epochs_2 CBT + V3 approval/formatting → GPU MOSS Nano → buffered sentence playback. It does not replace the production ECHO routes.

See [the handover](../docs/handover/VOICE_IMPLEMENTATION.md) for setup, models, environment requirements, validation evidence and limitations. MOSS Nano is the only active conversation TTS model. Whisper and CBT remain separate recognition/reply models; Nano does not replace them.

Keep requirements-speech.txt, requirements-cbt.txt and requirements-nano.txt in their separate environments. Do not combine these requirements into one environment.

Start from this folder using your speech interpreter: `python -B server.py`, then open http://127.0.0.1:8766. Use Load models first. Speech segments offers Current buffered mode or First 2 individually, then batches of 3. The latter keeps one sentence per segment. Leave Wait for full response unchecked for early speech. English is supported; Filipino/Taglish remain explicit unsupported experiments.

This repository contains source only. Model weights, generated voice WAV, runtime environments, cached custom code, audio, conversations and logs are excluded. Copy your existing generated Buddy voice sample and its metadata to voices/buddy/, or provision an authorized reference separately. Do not regenerate it if you want to retain that speaker identity. Legacy v1.5 helper files are retained from the development snapshot for traceability; /api/generate is disabled in this Nano application and no v1.5 worker is used by conversation inference.
