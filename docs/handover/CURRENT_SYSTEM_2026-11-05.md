> Latest validation update (2026-11-06): the user authorized testing under aggregate 28 GB RAM / 60% CPU limits. See [resource-limited results and remaining failures](../validation/RESOURCE_LIMITED_TESTS_2026-11-06.md), which supersedes the earlier source-only testing restriction. Full backend, type checks and lint passed; Python has three unresolved legacy framework-compatibility failures. Real-model, browser and hardware acceptance are reported separately. No new push.
>
> Current selection: startup-pinned shared Transformers/PEFT SeaLLMs with exact CBT/PHQ adapters; CUDA Nano Fast Talk; optional OpenMOSS llama.cpp MOSS v1.5 Expressive Talk. This supersedes older no-startup-load/page-exit-base-unload and active-CBT-GGUF descriptions below.

# Echo current-system handover — 2026-11-05

This is the current handover for the `echo-tailscale-remote` source checkpoint. It supersedes the October 31 model-integration handover for current runtime selection and voice behavior. Historical documents remain evidence of their original snapshots, not current configuration.

## Repository and rollback

- Repository: ShigatoraShuz/Echo. Publish only to `echo-tailscale-remote`; no main merge, force push or deployment.
- Pre-checkpoint local and fetched remote head: `403bb60e5a3839817fda699784409d12625cae0b`. The checkpoint commit following this document captures all currently publishable integration source, tests, locks, notices and documentation. Use `git log -1` on the branch for its exact checkpoint commit.
- Verified source archives are under the sibling local `Echo-recovery` directory. They exclude ignored models, environments, credentials and private records. A fresh archive is created before the checkpoint commit; these archives are not uploaded to GitHub.
- Restore source into a separate checkout or follow the selected archive's RESTORE.txt. Do not blindly overwrite the working directory, delete local records, rewrite branch history or reset unrelated work. To undo a published checkpoint, review a normal revert on an isolated branch first.

## Start and configuration

From the Echo repository root in PowerShell:

```powershell
.\scripts\start-local-core.ps1 -LocalJson -EnableBuddy
```

This starts Next.js on loopback 3000, Express 4200 and private FastAPI 8002. Do not run a second npm dev stack. The launcher verifies authenticated private transport before starting the app; transport readiness is distinct from model readiness. Startup does not submit draft text or warm the Buddy stack.

Private backend/frontend environment files must already be configured. Models under `models/`, installed GGUF/native runtime artifacts, voice reference and existing isolated Python environments must be provisioned locally; the Git checkout alone is not a complete runtime installation. Do not install packages or download model assets during ordinary inference. Use the explicit setup guides and verify hashes first.

Local JSON mode generates one ephemeral private credential shared by the coordinated backend and AI service. The ignored hosted-profile native-runtime.json credential is not the current local-JSON credential. Do not print credentials, persist diagnostic copies or mix independent launchers. Optional remote development derives its hostname from operator-provided ECHO_REMOTE_API_BASE_URL; no private hostname is included here.

## Active inference and data boundaries

| Component | Current behavior |
|---|---|
| Buddy Chat/Talk CBT | Exact mixed_epochs_2 adapter and declared SeaLLMs base, merged into verified Q4_K_M GGUF; resident owned CUDA llama.cpp server, shared Chat/Talk provider |
| CBT approval/formatting | Existing frozen V3 policy and internal formatting; support screening precedes ordinary generation; withheld drafts must not be displayed or spoken |
| Speech output | Vendored pinned MOSS Nano plus separate codec and cached conditioning from the existing generated Buddy reference; no older MOSS/MMS engine fallback |
| Transcription | Persistent faster-whisper in its configured speech environment, CPU INT8 requested; microphone captures are not persisted |
| Safety/distress | Existing XLM-R classifier/calibration, separate from emotion analysis |
| Text emotions | E4-C/RoBERTa Plutchik-eight emotion model; not the XLM-R safety model |
| Journal PHQ estimate | Isolated HF/PEFT/bitsandbytes worker with adapted/adapter-disabled agreement passes; not migrated to llama.cpp. Missing/unsupported scores remain null, never fabricated zeroes |
| Face | Existing local face_model package through persistent isolated face worker and consent/page ownership |
| Data | AI jobs/results and Buddy history remain local account-scoped JSON. Supabase remains login/account/access/consent and existing journal source storage. No automatic hosted history import or local-AI upload |

Interpreter choices remain explicit: core `.venv-core`, configured BUDDY_CBT_PYTHON, BUDDY_NANO_PYTHON and BUDDY_WHISPER_PYTHON; face uses its own configured isolated interpreter. See configuration and setup documentation for operator paths; environments were not copied into the bundle or modified by this checkpoint.

Controlled-job limits are decimal **28,000,000,000 bytes** and **60% CPU**, with at least **2 GiB global GPU headroom** required by model admission. These are owned-process-tree limits, not a whole-machine or aggregate-all-services quota. Conversion also has a sampled resident-memory watchdog; the native server cap uses Windows committed-memory accounting. Do not raise limits, change devices/adapters, shrink context or unload/reload as a silent fallback.

## Lifecycle and product changes captured

- Page/component leases deduplicate preparation across owners. Buddy Chat/Talk share CBT; Stop Talk releases speech resources while retaining CBT. Final-page-owner release has a ten-second grace; busy operations can delay actual release until a safe boundary. Hidden Talk pauses capture/playback rather than treating tab switching as logout.
- Model preparation uses five bounded attempts for eligible transient errors with 2/5/10/20-second retry delays. Permanent asset/dependency/access/CUDA errors fail directly. Hard cancellation of a hung native/face loader is still unfinished.
- Journal stage scheduling gives Buddy priority between stages, preserves saved jobs and rechecks ownership/consent on recovery. Detailed scheduler and browser acceptance is not complete.
- Same-origin shared application-session presence supports multiple tabs; no page-navigation logout or 30-minute inactivity timer. Final-tab exit uses reconnect grace and heartbeat expiry fallback. Cross-device, lost-close-event, backend-restart and browser Back/Forward acceptance remain unfinished.
- Journal tools include local in-memory Unicode PDF export, blank New Reflection versus explicit draft resume, eight detected Plutchik emotion filters with chronological sort, optional written/face discrepancy display and shared +63 mobile normalization. Account isolation and consent rules remain required.
- Optional PHQ failure no longer discards valid emotion/distress results. It remains nullable and is shown separately. Old failed jobs are not silently rewritten or resubmitted.
- Speech transport now separates bounded authenticated status polling from inference admission. Safe error codes distinguish auth/connection/throttle/timeouts/Nano failures. Read-aloud shows cancellable preparation and keeps approved text for synthesis-only retry.

## Validation evidence

Most recent speech repair: **112 focused tests passed** (11 launcher/loopback, 12 Python boundaries, 20 CoreClient, 31 protected voice/Talk/loading, 38 frontend). This is an affected-suite total, not a claim that the entire repository suite passed. Backend build and frontend type checks passed. The retry regression proves transcription and CBT run once despite failed audio and a speech retry.

Actual private-HTTP checks after one coordinated restart:

- Matching backend/AI credentials and endpoint; authenticated transport ready before app launch.
- Two separate bursts of 75 authenticated status polls did not consume inference admission.
- Nano-only warm 35.291 s and synthetic speech 8.678 s.
- Full Talk warm 141.816 s; CBT, Nano and CPU Whisper ready together; 9,441,484,800 bytes driver-wide GPU free after warm-up.
- Follow-on 48 kHz stereo synthetic speech succeeded in 9.614 s. Audio was validated in memory and discarded. Three sentences correctly scheduled [1,1,1]; longer [1,1,3,...] tests are recorded in the earlier Buddy report.
- Protected status responded in 22.5 ms while CBT loaded.
- Earlier synthetic PHQ diagnostic passed under the authorized 28 GB ceiling: load 15.797 s; available with coverage zero for non-symptom synthetic text. This verifies execution, not PHQ scoring accuracy or the cause of an old failed job.

For this publication, shared-contract build and both workspace type checks were rerun successfully. The architecture audit completed and reported 56 view, 24 route and 15 shared dependency edges; it did not assert an architecture-clean product. No full-suite rerun or full frontend production build is claimed here.

Detailed reports: ../validation/LOCAL_SPEECH_TRANSPORT_2026-11-05.md, ../validation/BUDDY_LLAMA_CPP_2026-11-05.md, ../validation/PHQ_NATIVE_DIAGNOSTIC_2026-11-05.md and ../lifecycle-implementation-status.md. Read their individual dates, scope and limitations before interpreting results.

## Unfinished work / next engineer

1. Authenticated browser acceptance: repeated automatic turns, typed-to-Talk context, autoplay blocking, speech retry, Interrupt/Stop, reload/navigation and multi-tab/page ownership. No authenticated tab was accessible to the automation tool during the latest speech repair.
2. Physical microphone/webcam, speech completeness, echo and human English listening review. Filipino/Taglish remain experimental/unverified.
3. Real scheduler stress: journal work during Talk, safe-stage yielding, maximum context/long replies, memory headroom, restart recovery and stable worker identities across repeated ordinary turns.
4. PHQ llama.cpp migration is not complete. Preserve both adapted and unadapted verification passes; never reuse the CBT-merged model for PHQ or its base check. The original saved PHQ failure lacked the exact exception; do not retrospectively label all old errors OOM.
5. Async JSON repository/indexing, comprehensive deletion fencing/reconciliation and account-export composition remain incomplete acceptance areas. Preserve existing valid records and account boundaries; do not import/delete hosted history or upload local AI records.
6. Component workers now isolate killable native loads. Continue testing saved-job safe-stage cancellation, parent startup/OS/driver failures and real final-owner timing; do not equate a ten-second grace with instantaneous VRAM release.
7. Broader product/auth/export/deletion and full-suite acceptance is unfinished. Earlier reports note baseline synthetic tokenizer/model mismatch failures; reproduce against the unchanged baseline before attributing failures or changing environments.

## Publication boundaries

The checkpoint includes source, tests, dependency/runtime lock definitions, font license and required bundled font. It excludes weights/GGUFs/codecs/voice WAVs, Python environments, local JSON conversations/results, runtime credentials, recordings, ignored diagnostic logs and local rollback archives. No database policy change, environment modification, main merge or deployment is part of publishing this checkpoint. See ../github-publication-audit-2026-11-05.md for audit scope and limits.


## Local follow-on after published checkpoint

C4 face-worker preparation now has cancellable, generation-fenced loading and in-child pinned package verification; 100 affected Python and 17 backend tests plus an installed-model blank-image/reload check passed. See ../validation/FACE_CANCELLABLE_PREPARATION_2026-11-05.md. These follow-on changes are local until explicitly committed/published. The backend now dispatches cooperative preparation cancellation outside its lease queue when final-owner grace expires; native component loading now runs in killable owned workers; existing saved-job safe-stage behavior and physical/browser acceptance remain unfinished. See ../validation/PAGE_LEASE_CANCELLATION_2026-11-05.md for 103 Python and 77 backend tests and the isolated real HTTP disconnect check. Restart the coordinated app to activate the local source changes.


## Latest local native-loader follow-on

Safety, emotion, PHQ and Buddy CPU safety now use owned isolated workers with bounded loading and independent inference limits. Final validation: 136 Python, 78 backend and 29 frontend tests; real repeated Journal IPC preserved safety/emotion while recovering PHQ alone. See ../validation/NATIVE_WORKER_ISOLATION_2026-11-05.md for measurements, strict PHQ output rejection and remaining browser/stress/storage work. These changes remain local after a6f44d8; no new push. The main app was stopped at the final check; start the normal launcher to activate the source changes.


## Urgent editor and gated shared-base follow-on

Save Reflection now keeps writing/tags/emotions/photos after save or queued analysis. Only explicit New/Write Another resets the editor; 28 focused frontend tests passed. See ../validation/REFLECTION_RETENTION_2026-11-05.md.

An offline unmerged base + exact CBT/PHQ LoRA bundle and private shared-worker integration now exist. One real base PID served approved CBT, PHQ, then approved CBT with Nano/codec on GPU and Whisper on CPU INT8. PHQ migration is NOT activated: Q4 and diagnostic Q8 both produced unsupported full coverage on a fixture where current HF returned coverage 0. Keep the current profile; do not bypass qualification during normal startup. See ../validation/SHARED_SEALLMS_2026-11-05.md for pins, timings, explicit setup/rollback and remaining acceptance. This supersedes earlier wording that PHQ migration has no implementation, but does not establish migration completion. Other unfinished storage/browser/hardware work remains unfinished. No new push.


Shared HF selection follow-through (2026-11-06): current Buddy now uses one Transformers/PEFT NF4 SeaLLMs base with exact mixed_epochs_2 CBT and PHQ adapters. This supersedes earlier statements that current CBT remains llama.cpp. The failed shared llama.cpp candidate remains inactive. Real initial switching matched PHQ coverage 0 and approved two CBT replies on one PID, with Nano headroom above 2 GiB. See ../validation/SHARED_HF_2026-11-06.md for checkpoint, configuration, slower CBT timing, final capped validation and remaining browser/hardware acceptance. No push or environment change.
