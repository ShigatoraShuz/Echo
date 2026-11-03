# Voice implementation handover — November 3, 2026

## Delivered stage

Branch voice-implementation, based on model-integration. Source snapshot: E:/Python Project/CODEX/TTS_INFERENCE_NANO_PRELOAD after restoring buffered playback and adding the optional first-two-then-three sentence mode. Unrelated dirty ECHO files were not included. Active code is isolated under voice/; production frontend/backend and safety routes are untouched.

## Models and environments

| Stage | Model | Environment |
| --- | --- | --- |
| Recognition | Local faster-whisper at E:/Python Project/CODEX/models/voice/whisper, CPU INT8 | speech-venv |
| Reply | SeaLLMs-v3-7B-Chat base, exact mixed_epochs_2/final_adapter, 4-bit NF4/BF16, copied V3 approval/formatting | Thesis2_VENV |
| Speech | OpenMOSS-Team/MOSS-TTS-Nano-100M + MOSS-Audio-Tokenizer-Nano, CUDA | voice/.venv-nano |

Model revisions and deployed weight checksums are in voice/models.lock.json. CBT base defaults to its adapter configuration; optional BUDDY_CBT_BASE overrides only that path. Other overrides: BUDDY_CBT_ADAPTER, BUDDY_CBT_PYTHON, BUDDY_WHISPER_DIR. Defaults preserve the developer machine's current paths. Shared model assets are read-only. No weights are stored in Git.

Three requirements files record directly used dependencies. Speech/Nano versions were read from their environments; CBT versions were read from installed metadata. These are not a claim that fresh installations or the CBT interpreter execute successfully. Node is used only for JavaScript checks, not to run the app. CUDA-compatible NVIDIA drivers are required for GPU inference.

## Setup and launch

1. Keep speech, CBT and Nano dependencies in separate environments. Reuse existing validated environments where possible.
2. From voice/, run setup_nano.py with the speech interpreter to create .venv-nano and download pinned official Nano/model-code assets. Existing environments are not modified. `--models-only` repairs model downloads without reinstalling packages. Setup includes .bin checkpoints and checks for actual weights; model revisions/runtime commit are pinned by models.lock.json.
3. Copy the locally generated voices/buddy/sample.wav AND metadata.json from the existing Nano app into this copy's voices/buddy/. Neither file is published here. Metadata SHA must match the WAV; invalid saved voices fail instead of changing identity.
4. Set model/environment path overrides if using a different machine. Start `python -B server.py` in voice/ with speech-venv. Open http://127.0.0.1:8766; avoid running two services on that port.
5. Load models, then Start conversation and grant microphone access. Type as a fallback. End stops recording; Unload models frees GPU resources.

CBT and Nano workers are persistent and remain resident on the GPU together. Their generation calls run sequentially. Warm-up requires at least 2 GiB global headroom. Interrupt kills active work and may reload both workers in this restored snapshot. Whisper loads lazily on CPU. History is stored locally in sessions/; microphone PCM is not retained. Synthesized WAVs/reports are local in results/.

## Speech and correctness

The complete CBT reply passes V3 checks before speech synthesis. Rejected drafts never reach playback. Formatting preserves non-whitespace content; the speech preview expands supported numeric forms. Sentence mode generates the first two sentences separately, then batches remaining sentences in groups of up to three. Each sentence is its own audio file; a final fragment is preserved. Long sentences over 512 tokenizer tokens are rejected rather than split or truncated. Default buffered mode remains available.

Nano reference and output WAVs use a scoped SoundFile adapter (wav_io.py), avoiding the observed Windows TorchCodec/FFmpeg DLL failure without changing packages or upstream files. The saved reference is encoded with Nano's codec and cached. This improves consistency but does not guarantee identical perceptual voice quality. Output is 48 kHz stereo; raw audio is retained and PCM16 playback uses short fades/peak protection.

Worker segment events are request-tagged and only atomically published playback WAVs are served. The browser queues segments with Web Audio, pauses for buffering when necessary, and keeps the microphone suspended until all speech finishes. Wait for full response retains whole-WAV playback. Interrupt/Stop/End invalidate pending audio. Retry speech reuses the approved text rather than generating another CBT answer.

## Validation evidence and limits

Before this export: seven sentence-boundary/scheduling tests passed. Actual CUDA Nano inference of seven sentences produced batch sizes [1,1,3,2], with first sentence ready at 3.92 s, second at 6.01 s, total generation 16.16 s for 12.64 s audio. Earlier buffered mode emitted the first segment at 4.57 s versus 32.08 s for complete generation. These are standalone synthesis measurements, not end-to-end conversation benchmarks or proof of uninterrupted playback.

Earlier validation included 39 restored Python checks, browser queue tests in a mocked DOM, five SoundFile/WAV checks, and the copied V3 regression suite. Run current source tests from voice/: `python -m unittest -v test_buffered test_resident test_checkpoints test_sentences test_local.TextTests test_offline.ProtocolTests`; `node test_buffered.js`; `node --check conversation.js`. Voice/WAV checks additionally need a provisioned local reference. Run `python validate_preload.py` for real persistent-worker/context/memory checks after environments and assets are ready.

Known blocker: the Codex execution account could not read Thesis2_VENV/Lib/urllib/__init__.py, even after approval. Combined CBT/Nano conversation validation remains unverified; normal-account testing is required. Do not claim full GPU co-residency quality, clinical safety, microphone behavior, speaker latency or listening quality from unit tests. Nano officially lacks Tagalog support: Filipino/Taglish are opt-in unsupported experiments.

This standalone V3 policy does not reproduce ECHO's full support screening stack. Existing ECHO safety behavior is unchanged. No new production integration, fallback model, translator, security-setting change or shared-package upgrade is part of this branch.
