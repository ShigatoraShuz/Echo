# Local speech transport repair — 2026-11-05

## Diagnosis

The saved native-runtime.json credential is not the credential used by local JSON mode. That profile intentionally generates an ephemeral private service credential per coordinated launch without writing it to the hosted profile file. Therefore the earlier 401 obtained using the saved credential did not establish an active credential mismatch. Direct inspection of the restarted backend and listening AI process confirmed matching in-memory credentials and the expected loopback endpoint; no credential values were printed or persisted by diagnostics.

The running AI service returned 429 while CBT was loading. All status polling, control and inference previously consumed the same 60/minute client-IP bucket. Status polling could exhaust inference admission, and CoreClient discarded the 429 distinction as generic AI_UNAVAILABLE. This is a demonstrated transport failure; it does not establish the cause of every historical speech error.

## Implementation

- The integrated launcher checks the protected preparation endpoint using the same credential passed to backend and AI before launching the app. This GET submits no draft text, loads no model and accepts a loading state as transport-ready. Authentication, throttle, connection and invalid-response failures have fixed sanitized diagnostics.
- Valid internal-token status GETs to /v2/preparation and /v2/runtime have a separate bounded 600/minute bucket. Authenticated non-status requests retain the configured inference budget (default 60/minute). Unauthenticated traffic retains its existing separate budget and cannot consume authenticated admission. This remains a per-process, per-client-host limiter, not a distributed quota. No authentication or origin restriction is bypassed.
- Speech transport preserves authentication, throttling, connection, timeout, unavailable-runtime and malformed-response codes. Existing sanitized BUDDY_NANO_* errors remain intact. Arbitrary upstream bodies, paths, credentials, rejected drafts and raw audio are not included in diagnostic errors.
- Read-aloud has distinct preparing versus speaking state, visible preparation text and a cancellation action. Its browser request window accommodates existing preparation retries; server generation deadlines and microphone recording limits remain unchanged. Talk speech failures retain approved text and map the safe underlying cause. Retrying speech does not regenerate CBT.
- No models, model environments, account credentials, Supabase policies, storage format or speech reference were changed. Existing decimal 28 GB controlled-job memory ceilings and 60% CPU caps remain unchanged; these are not whole-machine quotas.

## Automated validation

- Launcher/loopback tests: 11 passed.
- Python limiter, health and speech-boundary tests: 12 passed.
- CoreClient tests: 20 passed.
- Existing protected voice, Talk and model-loading tests: 31 passed. The malformed-audio Talk case now also retries speech successfully and asserts exactly one transcription and one CBT generation.
- Frontend error, voice preparation/cancellation/retry, realtime Talk and Buddy view regressions: 38 passed.
- Backend TypeScript build, frontend type check, launcher syntax and git diff --check passed.
- Initial Python invocation exposed test import-order dependence on settings plus sandbox temporary-directory access. Re-running with a fixed synthetic AI_SERVICE_TOKEN before import and normal temporary-directory access passed. No production environment setting was altered to satisfy tests. Existing Vite and Starlette deprecation warnings remain.

## Actual service/model checks

Restarted only the verified integrated Echo process tree, using start-local-core.ps1 -LocalJson -EnableBuddy with its existing launch configuration. Ports 3000, 4200 and 8002 are listening. Authenticated preparation returned 200 with preparation null immediately after startup; the new launcher transport check passed before app launch.

Two independent real private-HTTP probes each made 75 authenticated status GETs, exceeding the old shared 60/minute budget, and then successfully prepared/synthesized speech. Audio was decoded/checked in memory and discarded; synthetic fixed text only, no account/journal data or microphone recordings.

| Check | Result |
|---|---|
| Nano-only preparation | 35.291 s; ready |
| Nano-only synthesis | 8.678 s; 1,489,920 bytes PCM |
| Full Talk preparation | 141.816 s; CBT, Nano and CPU Whisper ready; three workers |
| Post-warm driver-wide GPU free | 9,441,484,800 bytes; above 2 GiB requirement |
| Full Talk synthesis | 9.614 s; 1,489,920 bytes PCM |
| Format | 48 kHz, stereo, signed 16-bit PCM |
| Three-sentence schedule | [1,1,1], correctly applying the first-two-individually rule |
| Protected status while CBT loaded | 200 in 22.5 ms |

The synthetic sessions were closed after testing, releasing their speech resources through the existing lifecycle. These probes verified private transport and models; they did not exercise account-scoped HTTP authorization, actual browser Start Talk, microphone transcription or browser audio playback. Security/unit regressions cover those contracts but do not replace real browser acceptance.

## Remaining acceptance and operation

No authenticated browser tab was exposed to the available browser tool. Physical microphone, autoplay, echo and listening quality remain unverified. No full authenticated end-to-end conversation or speech quality claim is made.

The coordinated stack is running. From E:/Python Project/CODEX/Echo, the normal startup command remains:

```powershell
.\scripts\start-local-core.ps1 -LocalJson -EnableBuddy
```

Do not run a second npm dev stack alongside it. Refresh Buddy to receive UI changes and use its model-status icon while preparation completes. If speech fails, retry speech from the retained approved reply. No push or deployment was performed.

Pre-change verified source rollback checkpoint: C8-20261105T072422Z (1,969 source files), under Echo-recovery next to Echo. Ignored model assets, environments and private data are excluded. Diff review against that checkpoint found only the intended launcher, middleware, speech transport/UI and associated test changes before this documentation was added; unrelated integration work was preserved.
