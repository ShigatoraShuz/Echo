> Current selection update (2026-11-06): startup-pinned shared Transformers/PEFT SeaLLMs with exact CBT/PHQ adapters; unchanged CUDA Nano Fast Talk; optional repaired OpenMOSS llama.cpp MOSS v1.5 Expressive Talk. This supersedes older no-startup-load/page-exit-base-unload and active-CBT-GGUF descriptions below. See the current startup/voice guide and STARTUP_EXPRESSIVE_STRESS_2026-11-06 validation report. Browser/hardware/listening and broader acceptance remain unfinished. No new push.

# Lifecycle implementation status

The combined plan is NOT fully implemented or ready for acceptance.

Completed foundation:
- Token-free durable SessionPresenceStore with tab registration/heartbeat/release, 30-second last-tab grace, 90-second missing-heartbeat expiry, closed-session persistence and session-scoped logout.
- Four model-free backend tests passed for multiple tabs, refresh grace, restart, lost closure events and account/session isolation.

Integrated development activation:
- run-integrated-dev enables ECHO_APP_PRESENCE and NEXT_PUBLIC_APP_PRESENCE together.
- Protected session routes and authentication middleware use verified user/session identities. Closed app sessions receive HTTP 401; Talk authorization also checks closure.
- The browser boundary registers, heartbeats and releases presence. Volatile per-tab marker expiry is bypassed and inactivity logout is disabled when presence mode is enabled. Other launch profiles retain legacy behavior until explicitly enabled.
- Explicit logout closes the current app session and broadcasts logout; the same browser-session tabs clear their private views. Other devices are unaffected.
- Login's Remember me control is replaced by an explanatory session-policy label in this mode.
- Five backend presence/API tests and 27 frontend session/auth regression tests passed. Real authenticated multi-tab and last-tab browser acceptance remains pending.
- Model runtime lease cleanup is NOT yet integrated with session closure. Do not consider the complete logout/media/model acceptance requirement satisfied.

Outstanding implementation:
1. Finish real-browser session acceptance and connect session closure to all model/media leases.
2. Runtime component leases, independent CBT/speech readiness and unloading, Journal page ownership/recovery gating, immediate Talk loading and five-attempt preparation.
3. Explicit New/Resume/Edit draft behavior and stale callback protection.
4. Shared Philippine mobile input and matching backend validation.
5. Protected per-journal Unicode PDF generation and download contract.
6. Broad automated, real-model, authenticated multi-tab browser, physical media, listening and PDF visual acceptance.

All pre-existing uncommitted integration changes remain in place. No push, deployment, database-policy modification or Python environment change was performed.


Implemented journal/mobile work:
- Per-journal authenticated PDF route and real frontend download now work with a bundled licensed Noto Sans font, in-memory generation, pagination, no-store headers, filename sanitization and unsupported-glyph failure rather than silent character loss. The mock adapter also returns a PDF.
- PDF authentication/account ownership, Unicode generation and long-entry pagination tests pass.
- Shared Philippine mobile normalizer/schema and +63 input are connected to verification, guardians and the existing settings/trusted-contact telephone controls. Verification/contact APIs validate and normalize values. Fourteen format cases and two input interaction tests pass.
- Fixed an input accessibility regression found by tests: the decorative +63 prefix no longer changes the field label.
- Both backend and frontend TypeScript checks pass after these changes. Relevant settings/verification backend tests and existing journal frontend adapter/view tests pass.
- Added Node font dependencies only; no Python environment was changed. npm reports 14 moderate dependency advisories; no broad automatic dependency rewrite was performed.

Still unfinished:
- Page/model lease orchestration, component preparation retries, immediate split Talk warm-up and complete resource ownership/cleanup acceptance.
- Blank New Reflection with preserved drafts. The current database API upserts one draft per user; simply suppressing restoration would risk overwriting an existing draft. No unsafe reset/overwrite change was applied.
- Existing invalid legacy phone editing behavior needs the complete acceptance pass; no bulk migration occurred.
- Authenticated browser multi-tab/session lifecycle, PDF visual review, complete builds/full suites, and real GPU/media/listening acceptance remain pending.

The combined plan must not be marked complete based on the passing focused tests.


Further Buddy lifecycle implementation:
- Added warm_chat: page-entry preparation loads CBT/safety without Whisper/Nano.
- Stop Talk now removes Whisper/Nano while retaining healthy CBT; speech failure cleanup no longer evicts healthy CBT.
- Read-aloud uses warm_nano only; manual transcription uses warm_whisper only. Approved-text ownership checks remain unchanged.
- Loading checks have five transient attempts with 2/5/10/20-second delays; generation is not automatically retried. Component check timeouts are CBT 600s, Nano 300s and Whisper 180s; environment import preflight allows 180s.
- Buddy page entry now initiates preparation without the typing debounce.
- 47 focused Python lifecycle/worker tests, 11 Buddy frontend tests and 20 backend Talk/voice tests pass; both TypeScript checks pass. One voice fixture still mocked the retired speech API; updated it to the current resident protocol while retaining its ownership assertions, then the suite passed.

Not yet fulfilled: cross-tab runtime resource leases, Journal page ownership/preload/unload and recovery gating, split asynchronous model-ready reporting/retry deadlines across every transport, parallel speech preparation, persistent preloaded face worker, safe blank-new multi-draft behavior, and full browser/hardware acceptance. Existing full-stack preparation timeouts can still bound the aggregate retries; do not claim the entire retry/lease plan is complete.


Buddy page-lease phase completed:
- Added protected POST/GET/PUT/DELETE /ai/runtime/leases interfaces for the buddy_chat profile with shared validated response contracts.
- Leases are account/session-owned, deduplicated per client instance, renewed every 15 seconds, and expire after 60 seconds without renewal. Server checks expiry and confirmed app-session closure every five seconds after first acquisition.
- Models prepare once for concurrent owners. Leaving a page releases only its own lease; final release schedules unload after any pending preparation. Stale cleanup cannot unload a replacement owner. Explicit legacy unload refuses while page leases remain.
- Buddy UI now acquires a page lease rather than issuing global unload on every unmount. Late acquisition after unmount releases itself safely. Server shutdown closes the registry.
- Unknown/corrupt application-presence state is not interpreted as confirmed logout; lease expiry still cleans abandoned owners.
- Five backend lease tests passed, including cross-account/session rejection, deduplication, last-tab release, delayed preparation/navigation races, and expiry/logout cleanup.
- Thirteen Buddy frontend tests passed, including new independent-tab and late-acquisition tests. Twenty-one additional Talk/voice/session API tests passed in the focused backend regression run. Both TypeScript checks passed.
- A Buddy label encoding regression found by the existing UI test was corrected without relaxing the test.

Remaining work is still not complete: Journal runtime ownership/preload/unload and recovery gating, safe blank-New-Reflection draft handling, end-to-end readiness/retry transport deadlines, persistent face preload, and full real-browser/GPU/media validation. Only buddy_chat is currently accepted by the generic lease route; Journal/speech profiles must not be advertised as implemented.


Journal page-ownership phase completed:
- Added the journal lease profile to the protected runtime interface and shared contracts. The shared Journal layout retains ownership across list/editor/drafts/detail navigation, renews every 15 seconds, and releases on section exit. Private writing is not blocked by failed AI preparation.
- Journal entry prepares the existing safety classifier; permitted camera assets are prefetched without requesting camera permission or sending an image. Persistent expression-model residency is still pending.
- Local saved jobs are not recovered while their account has no Journal lease. They retain waiting_for_provider with page_inactive; return triggers the existing five-second recovery after consent, ownership and current-content checks.
- Private journal runtime controls are independent of Talk enablement. Owner metadata is server-derived SHA-256, not raw account IDs or client-supplied inference context. Each classifier/emotion/screening/assembly packet checks its owner before execution. Leaving account A cannot complete its late result while account B retains shared models.
- Final Journal release unloads only Journal-resident models after the active stage, without evicting Buddy workers. Journal model loading reports capacity waiting rather than evicting resident CBT. Capacity waiting retries on the five-second coordinator tick without hiding the state during GET polling.
- Added additive waitReason to progress contracts/UI, distinguishing page inactivity, Buddy priority and GPU capacity. Advancing/completing a job clears stale wait metadata.
- Fixed two issues found by tests: stale waitReason after completion, and duplicate preparation following page replacement. Also allowed a second Buddy page to reuse healthy CBT while another page owns Talk.
- Final focused checks: 58 Python worker/lifecycle tests, 16 backend lifecycle/privacy tests, 26 frontend Journal/Buddy/progress tests passed (100 total); contracts build and both TypeScript checks passed.
- Real GPU/page-transition and authenticated multi-tab browser checks remain unverified; no live jobs or microphone/camera captures were used for these tests.

Outstanding plan items now include safe blank-New-Reflection/draft preservation, persistent preloaded expression worker, complete async preparation/retry deadlines and progress across transports, and broad/full-build/browser/hardware acceptance. Do not treat older outstanding lists above as overriding the completed phases recorded here.


New Reflection / draft-preservation phase:
- /journal/new now opens empty title/body/tags/emotions/photos; account consent is preserved. It checks for an earlier draft without restoring that draft into the new editor or loading its photos.
- The existing database supports one saved draft per account. An earlier draft is preserved and shown through explicit Resume or guarded Discard actions. Saving the new reflection is blocked until that conflict is resolved; this phase does not introduce multiple stored drafts or a database migration.
- /journal/resume explicitly restores the current saved draft and its photos. The Drafts page uses this route.
- Starting New from the current editor saves pending writing first and requests a fresh keyed editor. If an earlier draft is already protected, replacing new unsaved text requires explicit confirmation. Section-level Journal model ownership stays in its shared layout.
- Draft creation uses insert rather than silent upsert. Updates compare the previous submission identity; concurrent/stale writers fail with DRAFT_CONFLICT. Identical retries after a lost acknowledgement remain idempotent. Guarded discard checks account, record ID and version, including legacy drafts without a key.
- Successful publication clears editor content and photo previews while retaining the saved-result/progress view. Write Another resets submission identity while preserving consent.
- Editor generation/lifetime checks prevent delayed saves, photo reads, photo reservation and navigation callbacks from updating a replacement editor. Leaving while Save waits for autosave stops that queued submission before it creates a journal. Already submitted server writes may finish; saved-draft conflicts and version checks preserve their records.
- Tests include blank New, explicit Resume, guarded and failed discard, stale/concurrent updates, legacy null-key records, lost acknowledgements, account isolation, publication reset, same-route New, delayed photo loading and leaving during autosave/photo reservation.

No database policy, schema, Python environment, model identity or original model assets were changed in this phase. Existing integration changes remain uncommitted; nothing was pushed or deployed.

Still pending for the overall plan: persistent preloaded expression worker, complete asynchronous preparation/progress and retry deadlines through every transport, parallel eligible speech preparation, remaining full-product/build acceptance, authenticated multi-tab/browser validation, real GPU/media execution and listening/PDF visual review. Earlier phase notes are historical; this entry supersedes their outstanding blank-New/draft item only.

Final automated validation for this phase: 157 Journal frontend tests across 30 files, 14 backend draft/export/lifecycle tests across three files, backend TypeScript, frontend TypeScript and git diff --check all pass. Browser behavior against live Supabase, physical media and full production builds were not run in this phase.


Buddy preparation-progress / retry-envelope phase:
- Added an allowlisted component-progress protocol over the existing private model-owner IPC. Progress packets never enter the final-response queue and only the active request ID may update the snapshot. Unknown fields, prompts, paths and untrusted codes are discarded. Snapshots returned to callers are detached.
- Protected GET /v2/preparation reads the main process snapshot without the GPU/request locks. Backend account/session-owned lease status attaches validated optional preparation fields through the shared contract. Private status reads are bounded to two seconds, deduplicated, cached briefly and bounded to 8 KiB; they do not restart preparation or generation.
- The existing Send-adjacent readiness icon opens a details panel showing the current component, state, elapsed time, attempt count, retry countdown, safe error code and correlation reference. The UI remains compact when details are closed and respects reduced-motion behavior.
- CBT/Nano/Whisper attempt budgets are 600/300/180 seconds including environment preflight. Nano warm-up shares its loading-attempt deadline and retry cleanup. Five transient attempts use the existing 2/5/10/20-second backoffs. Missing files, import/access failures, runtime/identity/metadata mismatch and CUDA/memory failures fail immediately. No user response generation is automatically retried.
- Fixed fixed-duration transport cancellation: only warm/warm_chat/warm_nano/warm_whisper receive the bounded 6,600-second aggregate preparation envelope in Python IPC and the private backend client. Ordinary synthesis/transcription/CBT generation deadlines are unchanged. This is a worst-case envelope, not a promise of a 110-minute session: existing session/auth expiry, Stop and cancellation still take precedence.
- Failed page preparation is latched for the current leases; polling, heartbeats and duplicate lease acquisition cannot reset exhausted attempts. Releasing all owners and entering anew permits an explicit fresh preparation cycle. Healthy CBT remains resident after a speech preparation failure/cancellation.
- Long read-aloud/transcription preparation now renews speech ownership from completion, preventing the original pre-load 60-second deadline from immediately expiring after loading. Talk readiness retains the actual post-Nano-warm-up global GPU-headroom measurement.
- Added tests for real child-process progress while a request is still running, response ordering, detached/redacted snapshots, foreign-request rejection, bounded attempts/backoff cancellation, Nano warm-up retries, expired preparation deadlines, permanent failures, long loading ownership, retained CBT, late lease release, optional contracts and icon details.

Known limitations that this phase does not claim to complete:
- Persistent face/expression preload and its full retry/progress policy remain outstanding, as do complete Journal-component retry/loading windows and parallel eligible Whisper preparation.
- Safety screening still uses the existing in-process loader; it reports checking/ready but does not yet have an isolated cancellable loader with five bounded attempts.
- Read-aloud/manual-transcription browser calls still combine preparation and inference under their existing browser request limit; splitting these into separate asynchronous preparation operations remains acceptance work. This phase fixes the Chat/Talk preparation IPC/backend envelopes, not every media entry point.
- Full production builds, authenticated browser multi-tab/Talk tests, real-model co-residency/stress checks and physical microphone/listening review remain unverified. No weights, model identities, environments or account policies were modified and nothing was pushed.

Final validation for the preparation-progress phase:
- 92 focused Python tests pass (worker/lifecycle, redaction/authentication, cancellation, scheduling and speech boundaries).
- 43 backend tests pass across eight loading/lease/Talk/journal/session suites.
- 193 frontend tests pass across 36 Buddy/Journal/service files.
- Shared contracts and backend builds, backend/frontend TypeScript checks and git diff --check pass.
- An additional checkpoint-diagnostic suite has four failures and 19 passes. An isolated git-archive copy of committed HEAD reproduces the same four failures: E4 tokenizer construction in normalization/component fixtures, XLM-R diagnostic tokenizer mismatch, and the overlong-input test encountering that mismatch first. No model/runtime dependency installation or policy relaxation was attempted. The initially found ordinary worker-call compatibility failure was fixed and the affected suites rerun successfully.
- Warnings remain for the installed Starlette/httpx test-client deprecation and existing Vitest/Tailwind test configuration. These are not real-model or browser acceptance results.


Immediate Start Talk / parallel speech-preparation phase:
- Once the existing CBT preparation has been joined, CPU INT8 Whisper preparation overlaps Nano/codec/reference loading and warm-up. Nano stays on the existing GPU-owner thread under the CoreRuntime lock; this change does not overlap GPU model execution or create a second CBT model. Safety and CBT preparation still precede the speech stage.
- A linked cancellation branch cancels Whisper on Nano failure and cancels Nano on Whisper failure. Original actionable CPU errors survive sibling cancellation. Both branches must complete before Talk reports ready. Late constructor results are closed rather than published after cancellation/shutdown, and an unfinished cancelled CPU branch prevents replacement speech loading until it exits.
- Progress emission serializes whole NDJSON frames across the two preparation threads. Generation-fenced progress ignores stale branches. The optional loadingComponents contract keeps the icon busy when one component is ready but another is loading; details identify concurrent components.
- Start Talk requests microphone permission from the click handler, starts the protected session request without waiting for microphone permission or AudioContext resume, and disables granted audio tracks during model preparation. The local worklet/source is connected only after server readiness. Permission is requested once per Start.
- Stop/page cleanup releases pending streams and audio contexts as well as active sessions. A permission result arriving after Stop is immediately released; a known late-created session is explicitly deleted. Duplicate ready events cannot connect a second microphone. A microphone disconnected during loading fails without starting capture.
- Server preparation rechecks cancellation/closure after awaiting shared CBT preparation so a stopped session cannot later start its speech workers. Speech-worker loss releases speech resources while keeping healthy page-owned CBT.
- Tests explicitly coordinate CPU/GPU preparation overlap, GPU thread ownership, either-branch failure, Stop during both branches, delayed process construction, stale progress, atomic concurrent status frames, microphone denial/late permission, Stop during session creation, duplicate readiness, blocked AudioContext resume and microphone disconnection.

This completes eligible Whisper/Nano preparation overlap; it does not demonstrate a measured hardware speed-up. Persistent expression preload, isolated bounded safety/Journal loading, separate asynchronous read-aloud/manual-transcription preparation, full production/frontend-build acceptance, real authenticated multi-tab/Talk/GPU tests and physical microphone/listening review remain outstanding. Existing four checkpoint-diagnostic baseline failures are unchanged. No environments, weights, model identities, database policies, push or deployment were changed.

Validation for the parallel Talk phase: 100 focused Python tests, 44 backend tests across eight suites, and 201 frontend tests across 37 Buddy/Journal/service files pass. Shared-contract and backend builds, frontend TypeScript and diff whitespace checks pass. Browser API tests use doubles; they do not establish hardware microphone behavior, measured loading latency, GPU co-residency, echo control or speech quality. No real user recordings or model inference were generated in these checks.


Chat Send during SSD loading (2026-11-05):
- Found a conflicting path: Send previously awaited the full asynchronous preparation inside a 315-second browser request, while preparation permits a longer bounded retry envelope. The quoted generic frontend message is the fallback for an HTTP failure without usable error details; no authenticated live failing request was captured to establish that every occurrence has this cause.
- Ordinary Send now returns BUDDY_LOADING promptly while preparation continues, without model inference or saving the unsent turn. It joins the existing preparation rather than restarting it. A failed preparation remains a specific failure and is not silently retried by Send. Existing urgent/support routing stays before the loading gate.
- Frontend maps BUDDY_LOADING to a separate informational status, removes the unsent optimistic turn and restores typed text. Once readiness arrives, the notice asks the user to press Send explicitly; responses are not automatically submitted or generated again.
- Retried validation: 29 backend loading/voice/Talk tests and 93 frontend Buddy/API/error tests pass. Backend build, frontend TypeScript and diff checks pass. A test-fixture mock reset was corrected before the successful run.
- The running backend must be restarted to use the updated code. Real authenticated cold-SSD/browser acceptance remains unverified. No environments, weights or access policies were changed, and nothing was pushed.


Recovery implementation started (2026-11-05):
- C0 source checkpoint verified 1,942 files under E:/Python Project/CODEX/Echo-recovery/C0-20261104T230430Z. Includes tracked and untracked nonignored source with per-file hashes. Ignored credentials/data/models/environments are outside this archive and remain unchanged. No baseline Git commit or credentials backup has yet been created; archive checkpoints must not be described as Git commits.
- Urgent C1 implementation adds the eight detected Plutchik emotion filters to Notebook and list views, an optional emotion API parameter, and dominantEmotion response mapping. Saved real v2/v3 analysis is the source; legacy, missing and simulated predictions do not acquire invented labels. Filtering is owner-scoped and occurs before pagination/counts, retaining oldest/newest ordering. Stored legacy mood fields remain intact.
- Validation: 157 Journal frontend regression tests, eight backend list/export tests and five focused Notebook/adapter tests passed. Both frontend and backend TypeScript checks pass after correcting a test-only query option. Authenticated browser filtering has not yet been reviewed.
- Remaining stages C2-C8 are not implemented by this entry. Source checkpoints are local only and nothing has been pushed.


Urgent C2 implementation (2026-11-05):
- Added an optional protected text/face comparison to the existing journal face response. It checks journal ownership through the existing read, requires face consent and journal-analysis consent, and uses only the same journal's saved results.
- The card shows Same leading label, Different leading labels or Comparison unavailable, retaining both labels where available and explaining the limits of comparing expression with writing. It never combines probabilities, triggers inference or changes safety/screening outputs.
- Missing/legacy/simulated text signals and unusable face results remain unavailable. Missing or older source timestamps relative to journal updated_at reject comparison conservatively; this is timestamp revision checking, not a new cryptographic content-revision system. No records were migrated.
- Existing bounded polling can refresh a completed face result while its text signal is pending, and the analysis-completed event refreshes saved comparisons. Navigation aborts old requests.
- Final verification: 158 Journal frontend tests across 30 files and 14 backend list/comparison/face-provider tests passed; contracts build, backend build, frontend TypeScript and diff checks passed. Authenticated browser and webcam acceptance remain unverified.
- C0 and C1 are verified local source archives under E:/Python Project/CODEX/Echo-recovery. C2 is saved after this validation. These are not Git commits. Baseline commit review, secure configuration backup and the remaining C3-C8 work remain outstanding. No weights, Python environments or database policies changed; nothing was pushed.


C3 session-policy code phase (2026-11-05):
- Added a shared session-policy environment resolver used by localEnvironment. Supported interactive run-local-dev entry points and delegated app-only/encrypted startup now enable both ECHO_APP_PRESENCE and NEXT_PUBLIC_APP_PRESENCE consistently, matching the existing integrated model launcher. Conflicting or explicitly disabled flags fail before child services start. Restart frontend/backend together when changing these build/runtime flags.
- Existing production/manual entry points are not automatically rewritten; their explicit configuration and production browser acceptance remain outstanding. Legacy branches in the frontend remain available outside the supported launchers and must not be described as globally removed.
- Presence heartbeat requests are serialized. Slow requests cannot create overlapping renewals. Stale component callbacks cannot sign out or redirect a replacement boundary after the old boundary is unmounted.
- A temporary heartbeat failure now displays recoverable session-service feedback without clearing the current login. A later successful heartbeat clears that feedback. Protected server/session checks remain authoritative; unknown network state is not treated as confirmed session closure.
- Validation: eight Node launcher/proxy tests, 29 frontend session/auth tests and 12 backend durable-presence/API/lease tests pass. Frontend TypeScript passes; no Supabase policies or credentials were changed. Supabase changelog.md retrieval was attempted but the web tool rejected its text/markdown content type; no SDK API/signature changes were introduced.
- Authenticated browser multi-tab acceptance, actual tab close/crash/BFCache/restart checks, cross-device preservation and production-profile acceptance remain unfinished. C3 is a source-code checkpoint, not a declaration that browser acceptance is complete. No local checkpoint commits have been created; verified source archives remain the rollback mechanism.


C4 resident-face substage (2026-11-05):
- Added ResidentFaceRuntime for the main text-memory service. The original one-shot path remains compatible. The existing v4 feature extraction, selected classifier, preprocessing, runtime checks and model fingerprint are unchanged.
- The resident CPU worker loads the model and detector once, uses bounded request-ID NDJSON, and clears capture request variables after each result. Image payloads remain in memory, never command arguments/files. Child environment excludes service/database credentials and disables CUDA for this worker.
- Consent-enabled Journal owners are derived server-side and passed through the private journal-runtime contract as a subset of Journal owners. Journal preparation loads the face worker only when allowed. Final/no-permitted-owner release unloads it; shutdown closes it permanently. Prediction APIs retain existing consent/access checks.
- Face preparation has five transient attempts (2/5/10/20-second backoff), a 120-second attempt window, and immediate permanent package/import/access/interpreter failures. Generation remains bounded separately. Journal preparation's private backend window now allows this preparation envelope. FACE error codes survive the private HTTP boundary without paths or tracebacks.
- Unload generations fence late constructors/preparation so an abandoned load cannot reactivate a worker. Subsequent authorized preparation can create a new worker after unload.
- Validation: 39 focused Python tests and 23 backend Journal/face/loading/lease tests pass. Actual installed face environment loaded successfully on CPU; two generated blank PNG inputs reused one PID and both returned unavailable/no-face. No physical camera, human expression or classification-accuracy review was performed.
- This is the face substage of C4 only. Bounded safety/emotion/PHQ loading, all progress/readiness UI details and remaining media-preparation entry points are still outstanding. Do not mark the complete C4 stage achieved based on this result. No model assets, dependencies, environments or database policies changed; no push occurred.


C4 native-loader retry substage (2026-11-05):
- Added a shared loading-only retry policy to CoreRuntime for safety/XLM-R, emotion/E4 and PHQ native model acquisition (and the legacy Core CBT loader). The policy does not wrap inference, save operations, submissions or permission prompts.
- Explicit transient OS/connection/timeout failures receive five total attempts with 2/5/10/20-second backoff. Missing files, import/access/configuration failures and memory errors fail immediately. Unknown runtime/model errors are not assumed transient. Capacity waiting and cancellation pass through without retrying.
- Failed-load cleanup discards the failed component and partial allocations without broadly clearing other successfully resident components. Existing intentional scheduler memory-pressure evictions remain unchanged. Traceback references are cleared before cleanup to avoid retaining partial GPU allocations during backoff.
- NATIVE_SAFETY/EMOTION/PHQ/CBT error codes are sanitized and preserved through worker IPC, private HTTP and the backend client. Native Journal failures are no longer labeled as Buddy failures.
- Hard per-attempt preemption remains unfinished: these loaders execute in the shared native process, and a hung loader cannot safely be interrupted by a Python timer. Existing transport deadlines still bound requests and may cut short aggregate retries. Separate cancellable component preparation/process ownership and complete progress exposure are required before declaring C4 or all timeout acceptance complete. No inference deadlines were silently lengthened in this substage.
- Backend verification: 15 focused loading/Journal-priority tests pass; backend build and diff checks pass. New Python tests exercise five-attempt limits, permanent failures, zero-retry capacity/cancellation, healthy-resident preservation and no inference replay. No real safety/emotion/PHQ weights were loaded for these tests.
- The remaining llama.cpp conversion/integration, delayed unload, browser/hardware acceptance and checkpoint-commit/config-backup work remain outstanding. No model/environment/policy changes or push occurred.

Final native retry-substage validation: 124 Python tests passed across 11 native/Buddy/face/transport suites after correcting a synthetic fixture readiness flag; 15 backend tests and backend compilation passed. Remaining warnings concern the installed Starlette/httpx test client. This does not establish hard per-attempt loader interruption or real native-model performance.


C7 delayed-release substage (2026-11-05):
- Native hard-timeout isolation remains outstanding. The independent shared-release timer was implemented before the pending llama.cpp stages; checkpoint numbering reflects the plan stage rather than completed stages in sequence.
- Buddy and Journal final-owner release now starts a 10,000 ms server timer. Returning cancels the pending release; another owner prevents it. Buddy re-entry during grace reuses the existing preparation/readiness rather than starting another CBT load. Journal retains its owner/consent synchronization and cached component preparation.
- Added optional releasePending/releaseAt lease fields and protected Buddy runtime status. Repeated release of an already-unloaded registry does not create a phantom pending timer. Confirmed session closure and server shutdown bypass grace when no other owner needs the shared models.
- Journal owner removal still pauses admission immediately. Zero-owner metadata updates no longer unload the resident face worker early; the actual unload operation releases it after grace. Consent changes while other owners remain retain their existing face cleanup rules.
- Timer expiry queues release at the existing safe operation boundary. This does not implement hard cancellation of a stalled native loader or guarantee VRAM disappears exactly at ten seconds. Returning during already-started unload may require preparation after release completes.
- Tests cover nine-second return, ten-second expiry, unchanged CBT preparation count, multiple tabs, preparation exceeding grace, confirmed logout and shutdown. Existing Journal tests now assert immediate admission pause plus delayed model release.
- Validation: 46 backend tests, 20 Buddy/Journal frontend tests and 11 Python lifecycle tests pass; shared contracts/backend build and frontend types pass. No real-browser/GPU unload timing was measured. Existing browser-hidden Talk behavior and remaining C4/C5/C6/C8 acceptance are not marked complete.


C7 hidden-browser-tab substage (2026-11-05):
- Browser visibility changes no longer call full Talk stop. The session/socket and initial preparation remain alive; microphone tracks are disabled, worklet input is gated, queued playback is discarded and audio context is suspended. An active utterance/generation is cancelled through the existing protocol; ordinary initial preparation is not cancelled.
- A paused hidden session does not automatically resume on visibility, ready, recovered or playback callbacks. Resume Talk is explicit. Resume during loading resumes the audio context from that user action and waits for model readiness before attaching/listening, without a second application click or duplicate permission request.
- True page exit, component unmount, Stop and sensitive-state clearing retain full media/session cleanup. Buddy/Journal model ownership and their server-side final-owner grace remain separate from this capture suspension.
- Valid authenticated-session keepalive traffic now refreshes Talk's idle clock without warming models again. Existing token/session expiry and application-presence checks remain enforced. Browser freezing or prolonged missing heartbeats can still trigger the documented expiry fallback; this is not a guarantee of indefinite background residency.
- Validation: 55 frontend Buddy/ownership tests and 35 backend Talk/lease/Journal tests passed. Backend build, frontend TypeScript and diff checks passed. Tests cover hidden preparation, paused listening, cancelled active utterances, recovery without automatic capture, explicit resume before readiness, actual page exit and idle keepalive.
- Physical microphone/playback, browser background-throttling and authenticated multi-tab acceptance remain unverified. Hard native-loader interruption, llama.cpp stages and full remaining C8 acceptance are still unfinished. Nothing was pushed and no weights, environments or database policies changed.


C5 pinned-tooling substage (2026-11-05):
- Installed official llama.cpp b12110 CUDA 12.4 Windows binaries and CUDA runtime under the ignored local model root. Both archives were checked against pinned SHA-256 digests. The upstream commit is cd959bae99ff4bed22bef2604f45241c09bbb8c8; the exact source archive is separately checksum-pinned.
- Added explicit setup/verification tooling and a public revision lock. Source activation retains the upstream license and converter code together, publishes its manifest last and verifies source contents against the pinned archive on reuse. Corrupt archives, unsafe paths, missing pins and unexpected source files are rejected. Existing application startup never invokes this installer.
- Real probes: the installed llama-server reports build 12110 and detects the RTX 5070 Ti through CUDA. The pinned HF converter help imports successfully in the current core interpreter. These do not load weights or establish conversion/inference compatibility. No existing Python environment was changed.
- The upstream converter dependency profile differs from the existing environment. No package versions were silently installed. The original PHQ-declared base directory lacks configuration/tokenizer files; complete base identity remains unresolved and must not be assumed from a directory name.
- Conversion, exact-adapter merge validation, high-precision/Q4_K_M comparison, active llama.cpp integration and real co-residency remain unfinished. Native inference is unchanged. See docs/setup/LLAMA_CPP_PREPARATION.md for setup and remaining gates. No push, merge or database-policy changes occurred.


C5 exact-adapter conversion and resource-limit substage (2026-11-05):
- Added explicit offline source/resource preflight and CPU PEFT safe-merge -> BF16 GGUF -> Q4_K_M pipeline with exact adapter pins, full selected source hashes, shard coverage, tokenizer serialization, GGUF metadata/tensor checks, stage receipts and single-writer ownership. It does not change active inference.
- Real verification passed for 21 selected source files totaling 15,415,755,671 bytes; exact adapter hash remains 6bfe92fc0ba316997a18abcb7c79a1fda7cec608bce07baaa7719bfb47c7c04e. Source identity is af5e7caf52347e8f43f9780483ef3c67de2cec452b17ae4a78701beeb6891652.
- A real CPU BF16 merge attempt failed its fixed probe's maximum absolute logit tolerance: observed 0.8984375 versus 0.5; mean absolute difference 0.2845154107, RMS difference 0.3096076250, reference RMS 2.7221839428, leading token agreed. No merged/GGUF artifact was published. This requires numerical/merge investigation; the gate was not relaxed and no successful conversion is claimed. The original inference pipeline and adapter selection remain unchanged.
- User-requested conversion limits are enforced before loading: 25 GB decimal aggregate committed-memory cap and 60% CPU hard cap, inherited by child converters/quantizer. A 100 ms aggregate working-set watchdog stops the owned tree at the RAM budget; this sampled physical-memory check may briefly overshoot and does not cap total machine usage. No production inference quotas or environments were changed.
- Named-job membership validation handles nested Windows jobs. Suspended startup prevents an unrestricted venv child race; limit setup/verification failures stop execution. Source check/build commands automatically use this controller, without additional flags.
- Remaining: investigate BF16 merge discrepancy, produce/validate actual GGUFs, verify PHQ base identity and integrate/accept llama.cpp runtime. No pushes, merges, policy changes or environment installations.

Final resource-limit verification: 37 preparation/resource tests passed, including native Windows configured-limit queries, child inheritance, over-budget allocation denial, RAM-watchdog termination and refusal of an unrestricted internal worker. Windows rounds the requested 25,000,000,000-byte committed-memory ceiling down to 24,999,997,440 bytes on this machine; the supervisor reports the actual enforced value. Diff checks pass. No full conversion or runtime acceptance is claimed.


C5 CBT artifact preparation completed (2026-11-05):
- Replaced active full-model conversion merge with a bounded-memory safetensors-shard path. Plain LoRA deltas are added in FP32 and stored as BF16; every saved tensor is checked. Separate capped children run original/merged probes, with row-bounded FP32 linear arithmetic. Tests compare both the merge and arithmetic to independent tiny-model references.
- Real four-shard merge applied all 196 adapted layers and retained 339 tensors. The matched FP32-compute probe passed: max absolute difference 0.03273296356201172 versus unchanged 0.5 threshold, matching leading token and input/template fingerprints. Earlier BF16 diagnostic errors are not directly comparable because the arithmetic differs.
- Generated actual BF16 GGUF (15,237,851,104 bytes; ca2293da7f4409e5a430a17e44edb55a3a75b860d85dd226e2b0616e038226fa) and Q4_K_M (4,683,071,456 bytes; 04bade07fd81c4a116eb8f2b62da4ad0bb28b74bb15d2ed85e3a9cf70f6d4bb6) under models/llama/artifacts/cbt-mixed-epochs-2-q4_k_m. Both pass architecture/template/tensor-count checks. Q4 metadata reports file type 15, EOS 151645 and BOS/padding 151643.
- Fixed setup-worker USERNAME/cache handling without installing packages. Complete source identity and original adapter hashes are unchanged. Active inference remains unchanged; no runtime model selection was switched.
- The successful tree retained 25 GB/60% limits: peak committed 20,746,113,024 bytes; peak sampled resident 18,131,210,240 bytes. Quantizer time 107.892 seconds. Sampling does not prove an instantaneous physical-memory maximum; CPU percentage is configured rather than independently benchmarked.
- 45 preparation/resource regression tests pass; warnings concern installed deprecated APIs. Full product/browser/audio tests were not rerun for setup-only changes. See docs/validation/CBT_GGUF_PREPARATION_2026-11-05.md for exact evidence and limitations.
- This completes CBT artifact preparation only. PHQ base identity/conversion, llama.cpp runtime provider integration, generation/approval parity, GPU/headroom and browser/listening acceptance remain unfinished. No pushes, merges, policy changes or environment modifications.

Final C5 reuse check: a second capped invocation reverified the complete source/runtime/converter and output inventories offline, returned zero and reused the published local artifacts without rebuilding or loading models. Peak sampled resident memory for that verification-only tree was 59,658,240 bytes. Source rollback archive is saved after this report; ignored weights/configuration are not included in that archive.


C6 shared Buddy CBT llama.cpp provider substage (2026-11-05):
- Replaced active Buddy CBT model execution with the pinned Q4_K_M artifact while reusing V3 LocalCBT prompt/context/stop/retry/withhold/format methods. Locked V3 source/formatter files remain unchanged. Chat and Talk still share one provider/worker; Journal/native PHQ and other product models are untouched.
- Added authenticated loopback-only, one-slot owned native server, effective sampler/context/tokenizer checks, complete GPU layer/model-buffer proof and global 2 GiB headroom checks. Native server uses a Windows 25 GB committed-memory/60% CPU job. These are server-tree limits, not whole-machine limits. No model download, alternate adapter, CPU/native fallback or environment installation.
- Real configured checks: stable CBT Python/native PIDs across three turns; Nano plus codec/reference GPU-resident together with CBT; Whisper CPU INT8 (`int8_float32`). Approved first reply synthesized as six segments using [1,1,3,1], valid 48 kHz stereo PCM. Global free GPU memory after combined execution was about 9.716 GB.
- Explicit numbered-list follow-up passed with three steps, a subsequent turn used V3's original retry, and cancellation/replacement warming plus an approved recovery answer passed. A separate canonical 'List steps that I could do' run was withheld on both attempts (`requested_step_list_missing`); no drafts delivered. That quality limitation is recorded, not hidden or counted as success; no policy changes/fallbacks were introduced.
- Check/load/warm measured about 76–79 seconds excluding interpreter import preflight. Ordinary CBT replies about 1.2–4.1 seconds; approved speech synthesis about 29.98 seconds. Source hashing remains enabled. No browser playback or listening latency claim.
- 158 affected Python tests and shared-contract/backend builds pass. Remaining warning concerns installed Starlette/httpx deprecation. Real browser/microphone/listening and full app/journal/stress acceptance remain unfinished, as do PHQ/other compatible-LLM migration and earlier unresolved plan items.
- See docs/setup/BUDDY_LLAMA_CPP.md and docs/validation/BUDDY_LLAMA_CPP_2026-11-05.md. Existing login/project configuration, model environments, original weights, generated voice, history, database policies and unrelated integration changes are preserved. No push/merge/deployment.


Journal combined-analysis fault-isolation repair (2026-11-05):
- Investigated the reported failed emotion UI: XLM-R is the preceding safety/distress classifier; E4-C is the emotion model. Current bundled E4 tokenizer and real short synthetic CPU/GPU inference passed. Recent failed local jobs stopped at progress 25 but did not retain the exact exception; no private journal was resubmitted or edited.
- Found and repaired a split-transport mismatch: optional PHQ errors could abort the combined request, discarding successful E4/classification outputs while UI progress still indicated emotion. Recognized PHQ failures now produce nullable unavailable/failed screening, preserving existing native behavior. Busy/cancel/ownership, dead transports and genuine E4 errors remain failures/waits rather than fabricated results.
- Added stage-specific missing-PHQ code and safe backend error logging. Prior failed records remain unchanged, and attribution of the reported failure remains uncertain. Unknown later-stage errors may still show coarse UI progress; persisted granular diagnostics remain unfinished.
- 47 Python tests, 20 backend tests, backend build and diff checks passed. No weights, environments, manifests, label maps, account policies or safety checks changed. Restart AI/backend and manually retry through the existing authorized action. See docs/validation/JOURNAL_EMOTION_DIAGNOSTIC_2026-11-05.md. This is a repair substage, not complete C8/browser acceptance.


PHQ-specific diagnostic (2026-11-05):
- Latest saved result marks PHQ failed, not a missing/sparse-information score. All seven PHQ assets/checksums and tokenizer loading pass. PHQ still uses the legacy Transformers/PEFT/bitsandbytes path; Buddy's GGUF provider does not migrate it.
- Two capped isolated native-load probes (default and explicit BF16) exited 0xC0000005 around 62% weight loading, before inference. No cap increase or environment/model/production-code changes. Reported commit peaks around 26.57 GB and sampled resident around 11.6 GB do not by themselves prove OOM; the saved production exception remains unknown. See docs/validation/PHQ_NATIVE_DIAGNOSTIC_2026-11-05.md.
- Exact PHQ base/adapter migration plus preservation of the adapted/adapter-disabled agreement check and real output validation remain unfinished. No score was fabricated and no private journal was retried.


2026-11-05: User-authorized job memory ceiling increased to decimal 28 GB, CPU unchanged at 60%. Synthetic PHQ native load/inference now passes; 34 affected tests passed. See PHQ_NATIVE_DIAGNOSTIC_2026-11-05.md for measurements and acceptance limits.


2026-11-05 speech transport repair: separate authenticated status/inference rate buckets; authenticated launcher preflight; sanitized speech errors; visible cancellable read-aloud preparation and speech-only retry regression. Coordinated services restarted, both Nano-only and full Talk preparation/synthetic speech passed with >2 GiB global headroom. Physical microphone/authenticated-browser/listening acceptance remains unfinished. See validation/LOCAL_SPEECH_TRANSPORT_2026-11-05.md.


C4 cancellable-face preparation follow-on (2026-11-05, after a6f44d8):
- Model-package hashing, imports and estimator load now occur in the owned child under the 120-second response deadline; ready fingerprint is checked against the unchanged approved pins. Failed/hung children are terminated before retry.
- Immutable generation/cancellation identity covers queued admission, startup, ready, retry backoff and prediction. Unload cannot be overwritten by old failed/ready callbacks. Inference timeout never replays capture. Five transient attempts and permanent-failure handling are preserved.
- 100 affected Python tests and 17 backend tests passed. Installed model prepared in 3.499 seconds; two generated blank PNGs reused one PID, unload exited it and reload used a fresh PID. No physical camera or accuracy review.
- Backend final-page release is still queued after active operations; immediate page-exit preemption and shared safety/emotion/PHQ hard-preemption remain unfinished. This is a face-worker substage, not completion of all C4/C8 acceptance. Running app needs restart; changes remain local and were not pushed. See validation/FACE_CANCELLABLE_PREPARATION_2026-11-05.md.


C7 final-page preparation cancellation (2026-11-05):
- Preparation AbortControllers now leave the serialized lease work queue at final-owner grace expiry, confirmed logout or shutdown; another owner/return during grace protects the shared load. Late cancelled completions cannot mark replacement preparation ready or failed.
- Buddy warm_chat and Journal preparation propagate cancellation through private HTTP. The async Journal route monitors disconnects; face loading links the external event with its own generation. A stale Journal native stage cannot start face preparation after an unload.
- 103 Python and 77 backend tests passed; backend build, frontend types and diff checks passed. Isolated actual HTTP disconnect killed one synthetic owned face worker and returned unloaded in 0.114 seconds; all probe resources closed.
- This supersedes the earlier statement that all preparation release signals wait behind the lease queue. Shared native safety/emotion/PHQ calls still require a safe stage boundary and hard-preemption remains unfinished. No authenticated browser/GPU or physical-media acceptance is claimed; running Python service needs restart. Changes are local, not pushed. See validation/PAGE_LEASE_CANCELLATION_2026-11-05.md.


C4 native owned-worker isolation (2026-11-05):
- Safety/XLM-R, emotion/E4-C and PHQ now load/infer in separate resident owned workers. Buddy CPU safety is isolated too. Hard component load deadlines and five transient retries terminate only the failed worker; actual inference deadlines remain independent. Policy/model identities and PHQ's unadapted check are unchanged.
- Component-scoped asset verification retains all used-model/base checks; parent startup still verifies the full bundle. Loading HTTP/wire envelopes, scoped Journal/Buddy progress and driver-wide memory reporting are aligned. Limits remain 28 GB/60% per controlled tree, with 2 GiB global GPU reserve.
- Final checks: 136 Python, 78 backend, 29 frontend tests passed; contracts/backend build and frontend types passed. Installed GPU safety/emotion/PHQ and CPU safety each reused one PID for two calls and exited on close.
- Real isolated Journal IPC ran four requests: PHQ available, available, invalid output withheld, available after PHQ-only reload; eight emotions preserved throughout, safety/emotion loaded once, global GPU free ~5.6 GiB. Unload cleared all resident models. PHQ output quality remains imperfect and strict checks were not weakened.
- This supersedes earlier statements that native model loading remains in the shared controller. Remaining work includes parent startup/hardware fault boundaries, saved-job safe-stage cancellation, full authenticated browser/microphone/listening/stress and storage/export/deletion acceptance. The main app is stopped and must be started normally; no push. See validation/NATIVE_WORKER_ISOLATION_2026-11-05.md.


Urgent reflection retention and C5 shared-base follow-on (2026-11-06 reporting):
- Save/queued analysis preserves writing and photo previews; explicit New/Write Another resets the generation. 28 focused frontend tests and frontend types passed.
- Verified offline unmerged SeaLLMs base + separate exact mixed_epochs_2/PHQ LoRAs are prepared. Shared private worker integration, adapter-local requests, PHQ stage boundaries, cleanup and gated atomic selection are implemented.
- Real configured workers reused one GPU base across two approved CBT replies with PHQ between. Nano/codec/reference stayed on CUDA; Whisper used CPU INT8. Global headroom was 9,238,482,944 bytes. Normal PHQ remains native: shared Q4 and diagnostic Q8 failed supported-nullable agreement against the unchanged HF fixture. Do not claim C5 acceptance complete or enable the diagnostic bypass in normal startup.
- Final Python run: 462 passed, 33 failed, 5 skipped. Untouched HEAD reproduced all 34 initially observed failures; one architecture assertion was repaired and now passes. No new failure identities. Contracts/backend build, frontend types, 53 affected backend tests and 28 frontend tests passed.
- See validation/REFLECTION_RETENTION_2026-11-05.md and validation/SHARED_SEALLMS_2026-11-05.md. Context/recovery stress, storage/export/deletion, authenticated browser and physical-media acceptance remain unfinished. Source remains local; no push.


Shared HF selection follow-through (2026-11-06): current Buddy now uses one Transformers/PEFT NF4 SeaLLMs base with exact mixed_epochs_2 CBT and PHQ adapters. This supersedes earlier statements that current CBT remains llama.cpp. The failed shared llama.cpp candidate remains inactive. Real initial switching matched PHQ coverage 0 and approved two CBT replies on one PID, with Nano headroom above 2 GiB. See validation/SHARED_HF_2026-11-06.md for checkpoint, configuration, slower CBT timing, final capped validation and remaining browser/hardware acceptance. No push or environment change.
