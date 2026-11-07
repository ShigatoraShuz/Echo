# Current Buddy runtime and Talk voices

Start the coordinated local JSON stack from `E:\Python Project\CODEX\Echo`:

```powershell
.\scripts\start-local-core.ps1 -LocalJson -EnableBuddy
```

Restart the existing stack to apply these source changes. Private transport authentication is checked by the launcher. Existing account/project configuration remains required.

## Startup and ownership

The current runtime is Transformers/PEFT NF4, not the earlier CBT-merged GGUF. Service startup starts background loading/warming of one SeaLLMs-v3-7B-Chat base with the exact mixed_epochs_2 CBT and PHQ adapters. Loading does not generate an answer. Transport status stays responsive; loading failures remain preparation errors rather than readiness.

Chat and Talk share that base. Adapter selection and GPU operations are serialized. Ordinary page exits and Stop Talk release page-owned resources but retain the startup-owned base. Explicit Unload releases it when no conflicting owner exists; shutdown closes owned workers. Safety/emotion workers can yield between operations to preserve the global GPU reserve; the base and healthy PHQ ownership are not silently replaced.

The configured Windows jobs cap each controlled process tree at 28,000,000,000 committed bytes and 60% CPU. These are not total-machine caps. At least 2 GiB driver-wide GPU headroom is required; no CPU, adapter, context-limit or speech-engine substitution occurs when capacity is insufficient.

## Talk choices

- **Fast · MOSS Nano** remains the existing validated CUDA/PyTorch Nano model, codec and generated voice. Nano has not been changed to ONNX, audio.cpp or llama.cpp.
- **More expressive tone in Talk (slower) · MOSS v1.5** uses the pinned OpenMOSS llama.cpp fork and exact MOSS-TTS-v1.5 model, Q4_K_M backbone and F16 codec components. The label describes the selected model; better expressive quality remains subject to listening review.

Select the mode before Start Talk. Mode selection cannot change an active Talk session. CPU INT8 Whisper remains the transcription engine. Every engine reuses the original generated Buddy reference WAV; the native engine uses a verified 24 kHz mono derivative, not Nano reference codes. Native audio is converted to the existing 48 kHz stereo delivery format.

The native CLI currently loads its encoder, backbone and decoder sequentially for each sentence. Its Python worker retains verified assets and reference identity; this is not persistent native weight residency across sentences. Expect slower speech preparation. Prompts enter through stdin and WAV leaves through stdout; no temporary prompt/audio delivery files are created. Incomplete, crashed or partially decoded output is rejected.

## Explicit setup and validation

`ai-service/.venv-core/Scripts/python.exe scripts/setup-moss-native.py --setup` performs the explicit pinned native download/build/conversion. It does not install packages or change existing Python environments. Existing CUDA 13/VS2022 tools are required. Setup alone does not approve the backend: the tracked native lock must match the accepted local manifest and synthetic inference must pass. Normal inference is offline and fails if assets, binaries, identity or integrity checks fail.

The local source patch includes bounded memory I/O, complete-audio enforcement and a prefill output-index allocation repair found with AddressSanitizer. Notices and source revision remain in the ignored native bundle. Models and private generated audio are not Git source files.

Explicit synthetic checks (they intentionally load models, but use no account data):

```powershell
.\ai-service\.venv-core\Scripts\python.exe ai-service/tests/smoke_startup_expressive.py
.\ai-service\.venv-core\Scripts\python.exe ai-service/tests/smoke_maximum_context.py
```

See [validation and limitations](../validation/STARTUP_EXPRESSIVE_STRESS_2026-11-06.md). Browser, physical microphone, echo and human listening acceptance must be reported separately from synthetic GPU/ASR checks. Filipino and Taglish remain experimental.
