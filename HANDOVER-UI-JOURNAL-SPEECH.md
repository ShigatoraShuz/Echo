# Echo Handover — UI Update in Journal and Speech to Text

## Current branch

Updated 2026-11-18 (Asia/Taipei). Target branch: `UI-Update-in-Journal-and-Speech-to-Text`.

This handover covers the accumulated local changes being pushed to that branch, including the already-completed merge of `Final-Update`. No new implementation changes are part of preparing this handover. Model-environment installation instructions and the complete requirements index are in [All model environments](docs/setup/ALL_MODEL_ENVIRONMENTS.md).

The guide also includes the read-only inventory of all four Thesis2 environments, four complete package/version inventory files, the broken copied face-venv diagnosis, and separate instructions for Echo installation versus optional research-environment reconstruction. No package installation, environment repair, or implementation change was performed while preparing these handover files.

## Completed work

- Added journal dictation controls with Whisper and browser speech recognition options.
- Added speech-provider selection for journal dictation and Buddy voice workflows.
- Added Deep analysis toggle behavior for journal distress/category details.
- PHQ-8 item details now show `Evidenced` or `Not evidenced` when Deep analysis is off, and numeric frequency values when it is on.
- Removed partial subtotal wording from journal-facing PHQ-8 displays.
- Added the PHQ-8 meter to journal analysis and fixed the partial-range needle to indicate the range midpoint.
- Made text/face emotion comparison revision-aware and rejected stale comparisons safely.
- Emphasized `Different leading labels` in face/text comparison results.
- Added local face model/runtime restoration and related setup/configuration files.
- Preserved existing SEA-LION, CBT, PHQ-8, MOSS, Whisper, and Buddy runtime work already present in the working tree.

## Validation

- Frontend journal analysis tests passed.
- Frontend local face comparison tests passed.
- Backend journal signal comparison tests passed.
- Frontend and backend TypeScript checks passed.

## Notes for the next developer

- The Thesis2 environment remains external and read-only; local speech, Nano, MOSS, and face environments live under the Echo workspace.
- Run the focused frontend tests with the repository-local temporary directory if Windows reports a Vitest temporary-file rename error.
- Re-run the full frontend/backend suites before merging because this branch includes the broader Buddy and speech changes accumulated in the working tree.

## Latest journal comparison fix

- Text/face comparison now uses a server-generated identity of the exact journal body and journal ID. General update timestamps do not establish source identity.
- Local text-analysis jobs persist source metadata. Face output and its source identity are saved together. Hosted source metadata is kept inside encrypted result payloads and removed before public result validation/serialization.
- Journal worker claims retain their input identity for completion checks. If that in-memory claim metadata is unavailable after a restart, the result remains unverifiable rather than being assigned an invented source.
- Missing, stale, and unverifiable text/face sources have separate explanations. Existing usable individual labels remain visible; a comparison is produced only when both source identities match the current body.
- Journal controls provide **Analyze current text** and **Capture expression again**. Older results without a verifiable snapshot need these actions once. No automatic historical source backfill is performed.
- Metadata-only tag/privacy updates preserve encrypted content. Body edits invalidate comparison; local title-only changes retain valid body-based signals. Hosted title edits still follow the existing database content-edit invalidation routine because title/body share encrypted storage.
- Local text refresh retains prior text results. Local replacement face results retain prior face outputs. Existing hosted database retention/invalidation rules remain authoritative; no database migration is included.
- Both journal renderers share the comparison component. Journal PDFs report the same comparison and source-state reasons.
- The last implementation task changed only journal-related tracking, contracts, display/recovery, export, and tests. Earlier Buddy/dashboard/signup modifications in the same worktree are also included in this requested branch push.

## Buddy generation and speech changes already in this worktree

- SEA-LION/SeaLLMs uses the pinned `mixed_epochs_2` adapter (`6bfe92fc0ba316997a18abcb7c79a1fda7cec608bce07baaa7719bfb47c7c04e`). CBT/PHQ8 use the shared Transformers/PEFT base with separate adapters; PHQ8 is synthetic-only. No retraining was performed.
- Chat and Talk use 1,536-token initial/rewrite allowances, advisory style checks, and five bounded generation attempts with fresh attempt seeds. Counselor guidance, completeness, requested list counts capped at ten, and safety handling are retained. Journal recommendations explicitly keep strict review and the earlier 900/650 budgets.
- These generation policies differ from the exact previously reviewed configuration. Automated checks do not establish renewed counselor approval or clinical effectiveness.
- Talk loading is shown on the orb; Start Talk is disabled while its required runtime is preparing.
- Speech preparation logs retain HTTP status and sanitized cause codes. Ambiguous expressions and invalid coverage fail explicitly; transient errors retry, permanent validation/assets/authentication failures do not loop.
- Retry speech retains the approved answer. Capture waits for playback and server completion; playback-metadata failures do not prevent a following turn.
- Dashboard safety support was moved outside the PHQ8 card; narrow-screen dashboard entry transforms were disabled to avoid overlapping cards.
- A development registration-cookie path fix is included. This is not a claim that the complete signup/verification workflow has been live-validated.

## Verification evidence and limits

- Latest journal suites: **133 backend tests**, **26 frontend tests**; backend/frontend type checks passed.
- Speech-preparation suites: **42 Python**, **62 backend**, **35 frontend** tests; type checks and policy-integrity checks passed.
- Earlier Chat/Talk policy extension: **155 Python** and **76 backend** tests passed. These are separate focused runs, not one combined/full-suite count.
- Real synthetic Nano/Whisper check: ordinary reply, 2 segments / 5.92 seconds / 0.88 ASR token agreement; ten-item reply, 10 segments / 41.76 seconds / 0.9694 agreement. Normalized text coverage was preserved in both. The checker released its own workers.
- See [speech preparation record](docs/validation/SPEECH_PREPARATION_2026-11-18.md) and [counselor-policy record](docs/validation/TALK_COUNSELOR_POLICY_2026-11-18.md).
- Microphone behavior on physical devices, subjective listening, renewed counselor review, a fresh CBT generation comparison, and a full end-to-end hosted journal run remain manual/outstanding. Hosted paths have focused mocked/storage tests; no remote database migration was applied.
- Restart the coordinated launcher after Python changes; frontend hot reload alone does not reload resident Python workers.

## Restart and handoff

From the repository root, run `npm run dev:buddy`. Use `http://127.0.0.1:3000`; stop an existing coordinated instance before starting another. Regular `npm run dev` does not explicitly opt into Buddy preload.

Do not commit `.env`, runtime credentials, local journals, virtual environments, model weights, generated audio, or runtime-cache reports. Pinned requirement/source locks and installation instructions are tracked; actual model bundles and machine-local runtime configuration are intentionally ignored.
