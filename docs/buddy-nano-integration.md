# Buddy Chat and Nano Talk

This integration is based on verified origin/main commit `bc429205dd84148ec5d9cd2e0a8b04b795503738`, in the local `buddy-integration` branch at `E:\Python Project\CODEX\Echo`. No push or merge was performed.

## Behavior

Buddy Chat and Talk use one reply provider: the exact `mixed_epochs_2/final_adapter` plus the copied V3 approval, one-retry, withholding, and content-preserving formatting policy. Main's application support routing and frozen XLM-R screening remain before ordinary generation. A withheld draft is never displayed, persisted as Buddy's answer, or synthesized. The old adapter is not a fallback.

Talk uses Start Talk once, then automatic energy-delimited turns. The microphone is requested after model readiness, disabled while processing/buffering/speaking, and resumed after the complete reply plays. Interrupt clears playback and waits for worker recovery. Stop, conversation changes, page hiding, logout's sensitive-state event, and unmount release capture. Blocked playback exposes Play. Speech failure retains the approved text and offers speech-only retry with a new transport generation, without another CBT answer.

Default delivery is one sentence per segment, with batch sizes `[1,1,3,...]`; trailing fragments are retained. The buffered short-segment mode is also available. Only fully approved CBT text enters preparation; the displayed answer stays separate from speech-prepared wording. One following batch may synthesize while the current batch is delivered. Audio is PCM16, 48 kHz, stereo over explicitly versioned `echo-buddy-talk-v2`; v1 is not accepted by the new client.

The inline SVG mouth follows playback amplitude and honors reduced motion. It represents speech activity, not phonemes. English is the default. Filipino and Taglish require experimental opt-in and remain unsupported/unverified; Taglish uses automatic Whisper detection. No translation or alternate TTS fallback is introduced.

## Runtime and paths

The existing in-memory service boundary remains the GPU scheduler. CBT and Nano workers persist across normal turns, use serialized GPU operations, and include the Nano codec and saved conditioning. Start Talk loads/warm-ups both and requires 2 GiB globally free GPU memory after a three-sentence warm-up. Non-Buddy model loading evicts optional Buddy GPU workers. Worker failure removes readiness. Windows workers are created suspended, attached to an owned job, then resumed, so unload and parent exit release descendants through owned handles without process enumeration.

The exact adapter weights and adapter configuration hashes are pinned in `ai-service/app/buddy/config.py`. The base comes from that adapter's configuration; V3's base inventory integrity checks are preserved and extended across its listed base files. Model identity and V3 policy identity are recorded separately. V3 source is copied byte-for-byte under `app/buddy/v3`, with hashes in `v3-source.lock.json`; the wrapper replaces the old adapter inventory expectation with the selected adapter's exact identity.

Defaults use existing assets and environments:
- CBT Python: `C:/Users/tolen/miniconda3/envs/Thesis2_VENV/python.exe`
- CBT adapter: `E:/Python Project/PROJECTS/Thesis2/CBT_RESPONSE/CBT_BASE_MODEL/outputs/quality_tuning/mixed_epochs_2/final_adapter`
- Nano root: `E:/Python Project/CODEX/TTS_INFERENCE_NANO_PRELOAD`
- Nano Python: that root's `.venv-nano/Scripts/python.exe`
- Whisper Python: `E:/Python Project/CODEX/speech-venv/Scripts/python.exe`
- Whisper model: `E:/Python Project/CODEX/models/voice/whisper`

Operator overrides are `BUDDY_CBT_PYTHON`, `BUDDY_CBT_ADAPTER`, `BUDDY_NANO_ROOT`, `BUDDY_NANO_PYTHON`, `BUDDY_WHISPER_PYTHON`, and `BUDDY_WHISPER_DIR`. Paths are never accepted from clients. A different adapter/configuration fails the pinned identity checks. Nano requires the existing Torch 2.11.0 CUDA / Transformers 4.57.1 profile; no environment or package is silently replaced.

`assets.lock.json` records the official Nano/codec revisions and hashes from the current tester. Upstream inference code and notices remain in the configured Nano root, including its LICENSE and model READMEs. SoundFile reads the saved generated Buddy reference; the scoped WAV adapter avoids TorchCodec. Nano encodes and caches its own conditioning, without reusing full-MOSS codes. The reference WAV hash remains `3842d142fe4570197a059261467b806ccc36d2d35d4044255dc0d224be03a08f`. Missing, partial, changed, or corrupt reference data fails instead of generating a new voice.

## Start locally

The isolated `ai-service/.venv-core` is installed from `ai-service/requirements-core-windows.lock`. Dependency validation and a real CUDA kernel passed. The ignored environment is local and is not included in Git. CBT, Nano, and Whisper retain their separate existing environments unchanged.

From `E:\Python Project\CODEX\Echo`, use the existing launcher with the added opt-in:

```powershell
.\scripts\start-local-core.ps1 -EnableBuddy
```

Use main's existing local account/database configuration. `-AIOnly` can initialize the private service without launching the account UI. The launcher sets `ECHO_BUDDY_ENABLED=true`, `ECHO_REALTIME_TALK=true`, `REALTIME_TALK_ENABLED=true`, and `NEXT_PUBLIC_REALTIME_TALK=true` for this invocation. Without Talk opt-in, Buddy Chat still uses the exact new provider; other disabled transports remain disabled.

Open Echo's existing Buddy page, choose Talk, then Start Talk. Readiness must succeed before capture starts. Loading can take time; this does not promise real-time replies.

The previous CBT DLL-access failure occurred under restricted execution. Imports and real inference now pass in the authorized Windows execution context using the exact configured environment. Startup still reports environment failures explicitly and never selects another adapter or environment.

The installed shared model manifest includes obsolete CBT v5 inference-source entries. Buddy does not execute those sources: startup validates the adopted V3 source inventory instead. All non-Buddy inference-source hashes and shared model/base artifact checks remain enforced; the shared manifest and weights are unchanged.

GPU headroom is measured through the NVIDIA driver's global NVML counter, rather than process-local CUDA free-memory estimates. Startup and synthesis enforce at least 2 GiB free, with an additional conservative batch reservation before synthesis. Failure to read global memory disables readiness.

## Privacy and persistence

The protected HTTP/WebSocket transport retains account ownership, access/verification gates, origin validation, bounded frames, ticket authentication, history-off behavior, temporary context, and Echo's conversation repository. Standalone session APIs/HTML and standalone histories are not imported.

Workers receive only allowlisted environment values, with no database credentials or service tokens. Prompts, rejected drafts, microphone PCM, and generated speech are not written to payload files or worker logs. Audio delivery is bounded in memory; sessions persist transcript/approved answer and separate delivery/provenance metadata through Echo's existing repository. Raw microphone audio never enters history or exports.

Loading/warm-up, transcription, CBT generation/context reduction, first-segment readiness, synthesis, combined synthesis/delivery, and browser scheduled playback start are separately represented. Browser playback start is a scheduling estimate, not a hardware acoustic measurement. Voice identity and generation settings are included with TTS provenance.

## Validation

See [the validation report](buddy-nano-validation.md). Model-independent checks and synthetic-browser validation do not establish listening quality or real combined inference readiness.

Reproducible dotenv-free runners are `backend/vitest.buddy.config.ts` and `frontend/vitest.buddy.config.ts`. Example commands:

```powershell
npm run check:contracts
npm run typecheck
npm exec --workspace backend -- vitest run --config vitest.buddy.config.ts --maxWorkers=2 tests/security/realtime-talk.test.ts
$env:ECHO_VERIFY_BUDDY_BROWSER = "true"
npm exec --workspace backend -- vitest run --config vitest.buddy.config.ts --maxWorkers=1 tests/security/buddy-integration-browser.test.ts
```

The browser harness uses real headless Edge, the actual hook/avatar/transport, synthetic microphone waveforms, and stubbed models; it never opens microphone hardware. The final focused Python Buddy/V3 tests run under the installed core environment. Existing CBT, Nano, and Whisper model environments were not modified.

