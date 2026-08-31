# ECHO journal-analysis implementation

This implementation supplies encrypted submission, deterministic development fixtures,
and an authenticated external-worker protocol. It does **not** supply or verify a real AI model.

## Remote migration follow-up — 2026-08-31

After the implementation report below, the user explicitly authorized remote migration
application and deletion of the blocking orphaned records. This supersedes the original
no-remote-migration boundary for this operation only.

- Target: `ECHO UPDATED THESIS2` (`lruciislmmqvcwweqjop`).
- Preflight found five canonical journals and one draft whose owners no longer existed
  in `auth.users`. After explicit deletion approval, only those exact records were
  permanently deleted, with an orphan check repeated in the deletion transaction.
  No incoming foreign keys or user-defined triggers affected those deletions.
  Recovery would require an existing backup; no backup was created by this operation.
- Applied only `20260830010000_complete_journal_analysis_architecture.sql` using the
  linked Supabase migration command, without seeds, role files, resets, or history repair.
- Read-only postchecks confirmed the migration is recorded, no migrations remain
  pending, no orphaned canonical journals/drafts remain, and two journals plus one
  draft were preserved.
- The six-column status projection has RLS enabled and is published. Authenticated
  browser roles have SELECT but no write privileges and no private AI schema usage.
- This does not certify actual Realtime delivery, ciphertext backfill coverage, or
  model inference. No application deployment, Git commit, or Git push was performed.

The sections below describe the original implementation-stage boundaries and checks;
their statements that no remote migration was applied refer to that earlier stage.

## Approved-plan corrections implemented

1. **Submission, gates, and idempotency:** canonical normalized shared input; HMAC-SHA-256 keys with a dedicated secret/version; separate SHA-256 request hash; user + `journal.create` scope; 24-hour rejected reservations and successful identifier-only responses. Rejected retries do not extend expiry or overwrite success. A changed request—including turning analysis off—uses a new browser key. Explicit analysis requests with missing global consent receive a structured gate error, not a silent downgrade. An explicit private save creates no job.
2. **Atomic initial state:** the service-role submission RPC computes actual availability within the transaction, saves encrypted content, job/projection/audit and replay identifiers together. Disabled/unavailable workers wait; available workers and development stubs queue.
3. **Processor ownership:** only the bounded development runner invokes `AiAnalysisProvider.analyze`. Local-worker mode exposes `LocalWorkerProtocol`; it never invokes an in-process model. Startup recovery is scoped to the configured processor.
4. **State graph:** safety precedes analysis; safety pause requires a restricted reviewed decision. Requeues revalidate all current gates and create one transition receipt/audit. Progress uses the documented 5–65, 70–90, 92–98 attempt ranges; retry floors are 70 and 92. Failure retains progress; completed is 100. Terminal jobs reject further mutations.
5. **Callbacks:** credentials are bound to worker ID `local-worker`. Each callback (including lease heartbeat) supplies a unique `Idempotency-Key`; the backend hashes raw keys/tokens. Exact receipts replay; key/type/payload mismatch conflicts; expired/revoked/wrong leases fail closed. Mutation and receipt commit together. Completed replay requires the exact receipt and original worker/lease hashes; deletion overrides replay.
6. **Completion and aggregation:** immutable canonical result, versioned rule selection, terminal state, projection, audit, callback receipt and aggregation task share one commit. Aggregation is separate, retryable (five bounded attempts), unique by source/version, and recomputes user/week/version data. Simulated inputs never enter these aggregates.
7. **Ciphertext and schemas:** no columns removed. New/changed plaintext titles use `[encrypted]`; authenticated AES-GCM payloads are authoritative for reads. Backfill is keyset-paginated, resumable and uses compare-and-set updates. Missing encrypted titles may be filled; mismatches/unreadable rows fail coverage and remain pending investigation. Historical public journal/draft storage is included; ambiguous legacy ciphertext is not guessed. Browser privileges and Realtime publication are removed from private/legacy analysis tables.
8. **Realtime and frontend:** the only new published status row has user/journal/job IDs, status, progress, updated time. Owner-select RLS precedes publication; browser writes are revoked. Realtime invalidates authenticated polling; waiting and safety-review states continue polling. Drafts/keys survive unchanged errors. The modal opens on 202, restores identifiers, supports minimization, and does not invent progress. Dashboard and journal details refetch on completion; estimates remain non-diagnostic and simulations labeled.
9. **Safety and Buddy:** resources resolve by explicit country through Express. User-initiated trusted-contact requests validate ownership, permission, relationship and current adult policy and remain review-required; no guardian/contact message is sent automatically. Safety review uses a separate, initially empty `ai_analysis.safety_reviewers` allowlist. Buddy handoffs contain only approved features and reviewed activity identifiers; no journal text/safety evidence. Opening an activity does not automatically send a Buddy message.
10. **Retention/deletion:** journal soft deletion cancels jobs, revokes leases and removes public status. After 30 days source, jobs, results, selections, tasks and handoffs purge together; weekly metrics recompute. Handoffs expire at 90 days or source purge. Callback receipts expire 30 days after terminal completion; idempotency expires at 24 hours. Audits and safety records expire after one year and are anonymized on source/account purge. Cleanup is idempotent with a dry-run RPC. Timestamp expiry is authoritative; the backend sweep runs every 30 seconds while available, and catches up after outages.

## Repository evidence and boundaries

- The pre-edit baseline was verified: **94 backend / 260 frontend tests passed**.
- Historical `public.journals` retains nullable plaintext title/content and a different encrypted representation; `public.journal_drafts` has no plaintext title. They cannot be treated as the canonical service tables or silently overwritten. Backfill verifies both storage generations and reports failures without content.
- The existing server database type file contains no service schemas. Official regeneration must succeed before replacing it; the generator refuses empty/incomplete output. Browser models continue to come from shared contracts/authenticated API responses.
- The repository's current access policy is adult-only (`eligible_18_plus`), although older verification/Buddy copy mentions minors/guardians. The implementation fails closed for non-adult analysis/contact requests; it does not invent a guardian workflow.
- Seeded recommendation copy is deterministic application guidance, not a claim of clinical efficacy or a validated model. Any clinical deployment requires its own review.
- Docker Desktop reports **virtualization support not detected**. Native local Supabase migration/RLS/Realtime checks and official type generation cannot run on this host until that is resolved. PostgreSQL/WASM tests are supplemental and do not certify Supabase Auth, PostgREST or Realtime delivery.
- Existing user layout/style edits were left untouched. No applied migrations were edited; no database reset, remote database changes, commit, push or deployment was performed.

## Local verification and operation

Run from repository root:

```text
npm run check:contracts
npm run typecheck
npm test
npm run test:sql:isolated
npm run build
```

For native validation, use a **fresh disposable local Supabase project** containing the
repository configuration/migrations. Do not reset an existing project or use a linked
remote target. Once that local stack is healthy, run its migration/lint/RLS tests and
`npm run types:server:local`. The generator is hardcoded to `--local` and writes only
the backend type file after complete output succeeds.

The backfill and retention CLI commands reject non-loopback Supabase URLs:

```text
npm run backfill:journal-ciphertext -w backend
npm run retention:analysis -w backend
npm run retention:analysis -w backend -- --apply
```

The retention command defaults to dry run. Backfill returns only counts; nonzero
mismatch/unreadable counts set exit code 2 and require investigation. Never replace
authoritative encrypted titles with a legacy plaintext value. Column removal remains
a separately approved migration.

## Configuration and worker integration

`AI_ANALYSIS_MODE` defaults to `disabled`. `development_stub` is prohibited in
production. A fixture header additionally requires an allowlisted authenticated user
in `AI_DEVELOPMENT_USER_IDS`; the frontend flag is only selector visibility.

Generate independent secrets for `IDEMPOTENCY_HMAC_KEYS_JSON` and `AI_WORKER_TOKEN`.
Rotate HMAC keys by adding the new version, switching the single active version,
and keeping previous keys for at least the longest remaining 24-hour reservation.
Missing verification keys fail closed rather than creating duplicate submissions.

Worker endpoints are under `/api/v1/internal/ai` (using the app's normal v1 prefix):
`protocol-health`, `worker-health`, `jobs/claim`, and
`jobs/:jobId/{heartbeat,progress,safety-result,final-result,failure}`.
Worker health reports model status/version as **worker-reported**, never independently
verified. Leases last 60 seconds. Progress payloads contain a backend-allowed status,
not a caller-chosen percentage. Safety payloads contain `actionRequired`; failure
payloads contain `PROCESSING_FAILED`, `MODEL_UNAVAILABLE`, or `TIMEOUT` as `code`.
Final results must satisfy `echo-journal-analysis-v1` in the shared contracts.

No autonomous contact delivery, real model training/inference, deployment, or remote
database rollout is part of this implementation.

## Verification results

- Baseline before editing: backend **94/94**, frontend **260/260**, no mismatch.
- Final suites: backend **129/129** (28 files), frontend **271/271** (65 files).
- Shared-contract build, backend/frontend type checking, production builds and
  `git diff --check`: passed.
- Supplemental PostgreSQL/WASM: the complete migration chain and both new SQL
  suites passed (projection security and transactional lifecycle tests).
- Backend lint: no errors (existing/general console warnings remain).
- Repository lint is blocked by the pre-existing `no-this-alias` error at
  `frontend/src/features/buddy/view/__tests__/buddy-view.test.ts:32`; that unrelated
  test was not changed. Frontend also reports existing warnings.
- Native disposable Supabase migration validation, actual Realtime isolation,
  official service-schema type generation, and backfill coverage against real
  local data remain **unverified** because Docker cannot start without virtualization.
  The existing server type file was not overwritten with invented or partial types.
