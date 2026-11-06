# Talk and local recovery source checkpoint — 2026-11-06

This report describes source changes, not successful runtime acceptance. The user's no-testing restriction remains in force: no tests, type checks, builds, profiling, model execution, application startup or browser checks were run for this recovery. Regression files were authored but not executed. Historical passing reports do not validate these edits.

## Scope and preserved boundaries

Work remains on `echo-tailscale-remote`. Existing unrelated changes were retained. No push, merge, deployment, environment/package installation, model conversion, weight changes, database-policy changes or account-credential changes were made. The selected shared Transformers/PEFT SeaLLMs runtime, exact CBT/PHQ adapters, CUDA Nano, Buddy reference and MOSS native artifacts remain selected. The failed shared llama.cpp PHQ candidate remains inactive. Resource limits remain 28,000,000,000 bytes per controlled process tree, 60% CPU and 2 GiB global GPU reserve; this is not a measured whole-machine memory guarantee.

## Implementation and inspection matrix

| Area | Source changes | Acceptance still required |
|---|---|---|
| Startup | Preserve staged startup diagnostics and checksum-verification window; avoid a premature model-ready message | Coordinated cold startup and authenticated readiness |
| Talk liveness | Private reader-thread control messages bypass serialized inference admission; fast runtime activity snapshot; independent heartbeat deadline; refresh follows verified token expiry | Delayed inference/heartbeat, long loading, reconnect, real auth expiry |
| Turn recovery | Recover affected turns without discarding approved text; generation checks around authorization, preparation, persistence and delivery; independent playback warning | Timed-out old turns, late metadata, duplicate acknowledgement and cancellation fault tests |
| Nano | Exact text coverage checks; tokenizer-aware whitespace splitting before oversize input; preserved sentence batch ordering; explicit microphone sensitivity | Real pronunciation, missing/repeated words, quiet speech, ordered playback and listening review |
| Expressive | Validate required runtime artifacts separately from conversion inventory; publish verification/reference/admission/warm-up stages; accept MOSS worker contract and preserve native exit code | Actual manifest/binary compatibility, native heap repair, CUDA/reference warm-up and complete speech |
| Manual voice | Account-owned volatile preparation and processing jobs; short status requests; bounded in-memory results; cancellation and owned-session release | Read-aloud/transcription recovery, permission, Stop and result delivery |
| Journal scheduling | Independent recovery coordinator; actual GPU activity rather than idle Talk ownership; capture pause/recovery; cancellation on changed/deleted journal | Journal during Talk, restart recovery, consent/revision changes and worker death |
| JSON repository | Awaited atomic writes, writer lease, serialized mutations, detached records, committed-file hash checks, corruption isolation, startup summary index and pagination; deduplicated job creation | Disk-full/crash/replace failures, concurrent updates, restart and legacy fixture migration |
| Account data | Local export composed at download; strict ownership/completeness checks; independent confirmed-deletion reconciliation and durable deletion fencing | Authenticated export, deletion cancellation/finalization, late callbacks and profile switching |
| Frontend store changes | Store identity exposed; clear stale selection and pending send state; invalidate old callbacks; reacquire page lease on store change | Authenticated multi-tab/profile-switch/navigation behavior |
| Python compatibility | Source adjustments for renamed fast-tokenizer classes, legacy RoPE default and synthetic fixtures; optional audio test dependency reporting | Previously recorded broader Python failures require individual reruns; not all are established fixed |
| Optimization | Coalesced status requests, async storage/indexes and separate lease heartbeat; slower stable polling gated by `NEXT_PUBLIC_ECHO_OPTIMIZATIONS=true` | Comparable authorized measurements and resource/correctness regression checks |

## Checkpoints

Verified source archives were created before each priority stage, outside the repository:

- Priority 1: `E:\Python Project\CODEX\Echo-recovery\C7-20261106T103730Z`
- Priority 2: `E:\Python Project\CODEX\Echo-recovery\C7-20261106T104135Z`
- Priority 3: `E:\Python Project\CODEX\Echo-recovery\C7-20261106T104315Z`
- Priority 4: `E:\Python Project\CODEX\Echo-recovery\C7-20261106T110510Z`

Each contains `source.zip`, `manifest.json` with per-file SHA-256 and `RESTORE.txt`. These are source archives, not Git commits or backups of private records/models. Stop services before restoring; verify hashes, compare subsequent edits and restore selected files only. Do not reset the whole checkout or delete private records to roll back source changes. New additive storage-generation/revision fields must remain intact when recovering data.

## Startup and recovery instructions — not executed here

Use one coordinated launcher from `E:\Python Project\CODEX\Echo` when runtime execution is authorized:

```powershell
.\scripts\start-local-core.ps1 -LocalJson -EnableBuddy
```

Do not start a second backend against the same JSON root. Preserve ignored runtime configuration and use the launcher-managed private service credential. Check the reported startup stage if transport fails. A service-ready message does not prove Nano or Expressive readiness. Retain the approved answer and use speech retry after speech recovery instead of submitting another CBT request. Explicitly stop the stack before a source rollback.

## Known unfinished work and acceptance gates

1. Automated checks, builds, real model execution, maximum-context stress, GPU residency/headroom measurements and performance comparisons remain unexecuted under the no-testing instruction. Existing tests that assume synchronous stores require further fixture review/migration.
2. Authenticated multi-turn/multi-tab acceptance, PDF visual review, webcam/microphone capture, echo, pronunciation and voice consistency remain unfinished. Filipino/Taglish remain experimental.
3. Runtime cancellation, adapter restoration after process death and journal priority have source paths but require fault-injection and actual model validation. No guarantee of readiness follows from source inspection.
4. If a crash leaves records older than the durable deletion generation, startup preserves them and reports `LOCAL_DELETION_RECOVERY_REQUIRED`. They are excluded from active results, and complete export/deletion cannot claim success. Operator review is required. Automatic startup removal was rejected by approval review because it could irreversibly remove valid history; no such cleanup ran.
5. No measured optimization is accepted. Keep the optional slower stable polling disabled until authorized measurements show improvement without regressions.
6. Broader Python failures and production configuration/build acceptance remain unqualified. Do not describe the full recovery plan as complete until these gates pass.

Diagnostic additions use fixed stages/codes, bounded timings, correlation/operation identities and validated session identities. Do not add raw exception messages, prompts, credentials, rejected drafts, microphone audio or arbitrary paths to logs when investigating remaining failures.
