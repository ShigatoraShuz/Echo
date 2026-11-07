# C7: page-lease preparation cancellation — 2026-11-05

Later C4 follow-on: native model loading has now moved into owned workers. See NATIVE_WORKER_ISOLATION_2026-11-05.md; the historical limitations below describe this earlier substage.

## Implemented

The shared lease registry now owns an AbortController for each preparation. Final-owner grace expiry, confirmed session closure and shutdown abort that preparation outside the serialized work queue. Normal final exit retains the original ten-second grace. A returning owner during grace or another remaining owner prevents cancellation. A return after cancellation receives fresh preparation; late old completion cannot publish ready/failed into the replacement operation. Cleanup/unload remains serialized and checks ownership again before releasing resources.

Buddy page preparation forwards that signal to the existing warm_chat private transport, whose disconnect monitor and request-ID cancellation protocol already handle cooperative worker cancellation. Journal preparation now forwards the signal through CoreClient and an asynchronous private route. The route remains protected by the same internal credential, owner validation and request bounds; its disconnect monitor sets a request-scoped threading Event.

Journal's native stage observes cancellation at its existing safe boundary. Cancellation prevents subsequent face preparation. The captured face generation is also passed across that stage, so an older stage cannot start a new face load after a dispatched unload. An external cancellation event is linked to the face worker's own generation event; the owned worker is killed without replaying inference or replacing a newer state.

No public request/response schema, account/session scope, model policy, weights, reference, environments, database policies or resource caps changed. Stop Talk and unrelated active owners retain their existing protections. No push or deployment was performed for this local follow-on.

## Validation

- 103 affected Python tests passed across face cancellation/residency/boundaries, loading policies, Journal/Buddy lifecycle and text transport.
- 51 backend lease/Journal/loading/CoreClient tests passed, including final-owner grace expiry, return during grace, another owner, replacement after cancellation, shutdown and confirmed logout. A further 26 existing Talk/voice/face regressions passed (77 backend tests total).
- Backend build, frontend TypeScript and git diff --check passed. No frontend source or shared contract changes were required.
- Isolated real HTTP test: started the actual protected journal-runtime route on a temporary loopback port with a synthetic owned stalled face worker, then closed the TCP preparation connection. The route observed disconnect, the worker exited and status returned unloaded in 0.114 seconds. Exactly one worker started. No real model, microphone/camera or account data was used; the probe server and worker were closed afterward.
- Existing Vite/Starlette warnings remain. This is not an authenticated browser or full real-GPU acceptance result.

## Remaining limits

Cancellation is dispatched at the grace deadline; this is not a guarantee that all VRAM is freed exactly ten seconds after exit. Shared safety/emotion/PHQ native calls still execute inside the shared process and cannot yet be hard-preempted safely. A load already inside such a call reaches its existing safe boundary before cleanup proceeds; another queued operation may also delay admission. Face loading and the cooperative Buddy process loaders can honor cancellation while loading, subject to normal OS process teardown overhead.

Page/session heartbeat-expiry fallback and browser freezing still follow existing policy. Real multi-tab browser timing, physical capture, maximum-context/GPU stress and shared native-loader hard-preemption remain unfinished. The active coordinated Python service was not restarted; restart the usual launcher to activate these source changes. Source-only rollback archives exclude private runtime files and models.

Pre-change archive: sibling Echo-recovery/C7-20261105T092002Z. A post-validation C7 archive is created after this report.
