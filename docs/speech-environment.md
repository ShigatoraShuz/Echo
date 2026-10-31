# Local Buddy speech

> Experimental hands-free Talk is now available behind `-EnableRealtimeTalk`; see [real-time Talk](realtime-talk.md) for its MMS base voices, streaming behavior, verification and failed speed gate. The manual MOSS flow below remains the default when the flag is omitted.

Buddy supports Chat and Talk in the same conversation. Chat is the default. In Talk, explicitly press the microphone, speak, and press Stop: local Whisper transcribes the recording, the transcript is sent once, and MOSS speaks the approved Buddy reply. Switching modes or conversations cancels recording/playback. If autoplay is blocked, use the speaker button to retry. Text remains available when speech fails.

## Startup

From `E:\Python Project\CODEX\Echo`, run:

```powershell
.\scripts\start-local-core.ps1
```

Stop existing development instances first if ports 3000, 4200 or 8000 are occupied. The launcher selects local JSON mode and `CODEX/speech-venv/Scripts/python.exe`. It does not enable the database worker. Open Buddy and choose Talk. Microphone access requires a browser secure context (localhost or HTTPS) and explicit permission.

## Runtime and assets

Speech runs in the separate project-local `CODEX/speech-venv`; Thesis2_VENV remains the core service environment. The resolved speech packages are locked in `ai-service/requirements-speech.lock`: Torch/Torchaudio 2.11.0+cu130, Transformers 4.57.6, Faster-Whisper 1.2.1 and CTranslate2 4.8.4. Transformers 4.57.6 is required by the copied MOSS custom processor; the core service retains its own Transformers version. `pip check` passes. Nothing is installed globally.

Only copied assets under `CODEX/models/voice` are loaded, with offline loading enabled: Faster-Whisper large-v3-turbo, MOSS-TTS Local Transformer v1.5 and its audio tokenizer. `voice/manifest.json` records copied file hashes. MOSS uses its default voice; no reference recording, cloned voice or adaptation argument is supplied. No browser or cloud speech fallback is used.

Authenticated browser requests go to Express `/api/v1/buddy/voice/transcribe` and `/api/v1/buddy/voice/speak`; the internal Python endpoint is loopback and bearer protected. TTS accepts the exact approved Buddy response, rather than generating conversational content. Speech and core inference share one bounded GPU queue. The previous pipeline is unloaded before speech starts; a short-lived speech subprocess exits before the next GPU task is admitted. First requests include model load time and may take tens of seconds. Requests have bounded timeouts and explicit failures.

Recordings are limited to 60 seconds and 10 MiB encoded. Decoding checks duration and rejects video/non-audio input; silence sends nothing. Temporary request/audio files are removed on success, failure, cancellation or timeout. Browser tracks, playback and object URLs are released. Only conversation text and provenance follow local JSON history preferences; temporary conversations retain bounded in-memory context. Audio and model outputs are not written to Supabase.

## Verification

Dependency consistency, core speech authentication/body limits, process cancellation and temporary-file cleanup, decoded-audio size/duration rejection, Buddy ownership/context checks and Chat/Talk frontend tests pass. Frontend tests cover microphone denial, cancellation, late permission, recording failure, duplicate delivery and blocked playback cleanup. The actual-model Express/disposable-database/JSON integration passed in 460.23 seconds on 2026-10-31. It exercised three synthetic journal languages, Buddy generation, rejection of an unapproved TTS request, approved default-MOSS WAV generation, local Whisper transcription, and conversation reopen from JSON. Database assertions confirmed zero analysis requests/results and Buddy messages stored there. The GPU pipelines completed sequentially. Earlier synthetic Filipino and Taglish voice probes also produced nonempty local transcripts; these checks do not establish language accuracy or naturalness. Browser microphone hardware and listening quality remain unverified unless exercised on this installation.


Latest checks: 28 Buddy frontend tests, two backend voice/context tests, two Python speech-boundary tests and two speech-environment decoding/silence tests passed. Both TypeScript checks, backend build and targeted Python lint passed. No new dependencies or model weights were downloaded in this pass; existing installed packages were verified and the speech lock refreshed. No dependencies remain missing for the tested local STT/TTS path.
