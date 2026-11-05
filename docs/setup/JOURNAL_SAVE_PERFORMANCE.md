# Journal save performance — 6 November 2026

The private Tailscale frontend now separates confirmed journal creation from optional attachment finalization. Model weights, inference settings, backend consent/ownership checks, photo storage and encryption are unchanged.

## Changes

- Saving captures the current temporary camera frame immediately and aborts the older live-preview request instead of awaiting its inference. A regression keeps that preview promise unresolved forever and verifies that capture still completes, with fresh mesh metadata intact.
- If the current draft revision and submission key are already persisted, Save reuses them instead of writing the same draft again. Changed text still persists its new key before creating the journal.
- After the create request succeeds, the existing inline model-progress card starts immediately. A separate finalization message remains visible while optional attachments are confirmed. The final completion state and Write another reflection stay unavailable until those steps succeed.
- Face upload/persistence and draft-photo attachment run concurrently. Draft deletion occurs only after both complete successfully.
- A retry reuses the accepted journal. A successful face result is not submitted again after a photo failure. A failed face save retains its temporary frame in component memory for retry; no frame is added to browser storage or disk. Finalization/reset releases that reference.
- Existing saved-journal/report navigation stays inline and retains the current UI, photo safeguards and analysis flow.

## Validation

- Journal area: 27 files / 138 tests passed.
- Complete final frontend suite: 193 files / 1,288 tests passed.
- Type checking and production build passed. Changed-file lint had no errors; the existing image mock in the editor test retains its next/image warning.
- Tests cover a stalled preview, parallel face/photo completion, withholding draft cleanup/completion while attachments are pending, reused and changed submission identities, face/photo failures, and retries without creating another journal or resending a successful face result.
- Private HTTPS login and API readiness returned HTTP 200; API and model transport reported ready. Running build log: artifacts/model-integration/buddy-repair-20261104/journal-save-20261106.log.

## Actual private HTTPS verification

- Signed in using the user's remembered account on the private Tailscale URL. Preserved the initial empty draft and restored an empty, autosaved draft after testing.
- First fictional journal: confirmed creation and inline model progress appeared after 3,264 ms; finalization completed after 4,857 ms. The page stayed at /journal/new. Reopening verified the saved title and body. These are post-change observations, not a before/after benchmark.
- That first analysis failed because the isolated model worker was no longer running. The cause of its earlier exit is not established. Restarted only the owned Echo services with the repository stop/start scripts; Tailscale Serve remained configured. No model settings or weights changed.
- Recovery checks used fictional text: real classifier returned Others (15,218 ms cold); real analysis returned echo-journal-analysis-v3, joy, PHQ-8 available and isSimulated false (25,386 ms).
- Repeated the actual app save with a second clearly labeled fictional journal. Server confirmed journal creation once (HTTP 202, 3,202 ms), draft cleanup (HTTP 204, 766 ms) and completed model-result persistence (HTTP 200). The UI showed inline progress followed by Joy / Others / PHQ-8 3 of 8 evidenced. Reopened the saved reflection to verify persisted text and AI results. No duplicate create or page reload was observed during save.
- Both clearly labeled test journals remain in the account. The first retains its truthful failed analysis state; the second completed successfully.
- Recovery logs: artifacts/model-integration/buddy-repair-20261104/journal-save-recovery-20261106.log and its errors log.

## Limits

No valid face was in view during these live checks, and no photo was uploaded. Successful webcam/face and photo attachment persistence in this deployed build were therefore not reverified live; the parallelism, failure/retry, retained temporary-frame and cleanup behavior passed regression tests. The app reports skipped facial capture honestly. Save still waits for real storage confirmation; model inference continues independently and is not claimed to be instantaneous.