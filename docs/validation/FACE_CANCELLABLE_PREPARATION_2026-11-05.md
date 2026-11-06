# C4: cancellable face preparation — 2026-11-05

Later C4 follow-on: native model loading has now moved into owned workers. See NATIVE_WORKER_ISOLATION_2026-11-05.md; the historical limitations below describe this earlier substage.

Follow-on: page-lease cancellation dispatch is now implemented for cooperative preparation. See PAGE_LEASE_CANCELLATION_2026-11-05.md; the shared native-stage hard-preemption limitation remains. The report below records the earlier face-only substage.

## Scope

Follow-on local implementation after published checkpoint a6f44d8. This substage makes resident face model-package verification, native imports and model loading killable inside the existing owned worker. It does not complete the shared safety/emotion/PHQ hard-timeout architecture or all page-lifecycle acceptance. No model assets, package pins, environment packages, database policies, inference thresholds or resource limits changed. No push/deployment was performed for this substage.

## Changes

- Moved face model filesystem verification/hashing into the owned child before importing the package runtime or deserializing its estimator. Both worker and parent use the same existing approved package lock. The worker's ready response includes the pinned model fingerprint; a mismatch fails permanently.
- Each load attempt retains the 120-second preparation deadline. On a stalled response the parent terminates the owned process tree before retrying. Normal transient loading failures use five total attempts and existing 2/5/10/20-second delays. Permanent/unknown failures fail directly with sanitized codes. OS process launch and teardown add their ordinary overhead; this is not a guarantee of a hard wall clock on kernel/filesystem operations in the parent. Existing termination helper permits up to ten seconds of process-exit wait.
- Captured generation and cancellation events before operation admission. Queued preparations, child startup, ready replies, retry sleeps and prediction results all check that same identity. Unload cancels the current generation, detaches/kills its worker and preserves unloaded status; old callbacks cannot overwrite that status. A subsequent authorized call can prepare a fresh generation.
- Retry waits are interruptible. Responses are consumed from the request's own queue, rather than a replacement generation's queue. Concurrent healthy preparation reuses one worker. Capture inference retains its independent 90-second deadline, is never replayed automatically and reports an inference timeout separately from loading failure.
- Capture bytes and worker requests remain transient in-memory stdin/stdout data; no service/database credentials are inherited by the worker. One-shot compatibility retains the same result contract and now also enforces the approved inventory inside the worker.

## Automated validation

100 Python tests passed across face cancellation/residency/boundaries, Buddy/Journal lifecycle, loading policies and text transport. The owned-process fault tests cover five killed hung loaders, cancel during spawn, queued ownership, delayed ready, unload during capture, cancellable retry backoff, same-generation preparation deduplication, reload, incorrect fingerprints, tampered inventories and sanitized transient/permanent errors. Capture inference timeout creates one worker and does not replay the capture.

17 backend live-face/page-lifecycle/model-loading regression tests passed. git diff --check passed. The existing Starlette test-client and Vite configuration warnings remain. No frontend, public endpoint, shared response schema or backend code changed in this substage.

## Installed-model check

The configured existing face interpreter/model prepared in 3.499 seconds. Two generated 64x64 blank PNGs returned unavailable/no-face and reused the same worker PID. Unload verified process exit and unloaded status. A fresh preparation then used a different PID and returned ready. All probe workers were closed. PNG generation used the standard library; an initial probe assumption that the core environment provided Pillow was corrected without installing packages.

This verifies loading, protocol, no-face handling, reuse and cleanup. It does not test a physical camera, human expression classification, accuracy or authenticated browser consent flows.

## Remaining work

The backend model-lease registry still serializes final release behind an active preparation/operation. Therefore page exit does not yet guarantee immediate dispatch of face unload; ten-second grace is not hard preemption. Complete cancellation propagation through that registry/transport, respecting remaining owners and safe journal boundaries, before claiming end-to-end page-exit cancellation. Shared safety/emotion/PHQ loaders remain in the shared native process and still require separate hard-preemption work.

The running application was not restarted for these local source changes; restart the normal coordinated launcher to activate them. Original restart-safe JSON and broader browser/hardware acceptance remain as recorded in the current handover.

Pre-change verified source archive: sibling Echo-recovery/C4-20261105T090751Z. A further verified source archive is created after documentation/validation. Neither contains model weights, private runtime configuration or user data.
