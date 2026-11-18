# Echo Handover — UI Update in Journal and Speech to Text

## Current branch

This handover covers the Echo journal UI, speech-to-text, Buddy speech, and analysis-runtime changes prepared for the `UI Update in Journal and Speech to Text` branch.

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
