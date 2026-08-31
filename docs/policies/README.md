# Expanded review documents — version 2026-08-31.1

These are product-specific notice drafts, not a claim of legal approval or clinical certification. They describe ECHO's current implementation and distinguish available infrastructure from real model inference. An operator should review its own identity, contact channel, deployment, infrastructure backup practices, and jurisdictional obligations before a public launch. No operator address, statutory compliance claim, or support-response promise has been invented.

## Content

- AI Analysis Notice: 1,043 words; optional consent, per-entry requests, actual processing modes, uncertainty, safety review, recommendations, Buddy, withdrawal, and deletion.
- Privacy Notice: 1,173 words; account and journal data, authorized decryption, infrastructure, legacy migration limits, retention, deletion, and available controls.
- Terms of Use: 1,080 words; adult eligibility, account security, responsible use, optional analysis, support limits, privacy, service availability, and agreement.

The Markdown documents are the reviewable source. Their exact normalized content is included in `supabase/migrations/20260831010000_expanded_review_documents.sql`. The validation script verifies that the database text and SHA-256 hash match these sources. If wording changes before application, update both source and this unapplied migration; once applied, use another version and forward-only migration.

## Reader behavior

Signup and policy updates share a native modal dialog with semantic headings and lists, an inert background, focus restoration, an independent scroll area, and a fixed readable footer. Escape or Close for now dismisses without acknowledgement. The end-of-document check enables acknowledgement without requiring a scroll event when all content fits. Page Up, Page Down, Home, and End operate within the reading area. Reduced motion does not delay access.

Reaching the end does not itself mark a notice reviewed. Only the explicit acknowledgement does. Reading completion resets when a different document/version is opened. The final policy-update request contains the three reviewed document IDs. The backend rejects stale, duplicate, or incomplete IDs, records only the matching versions, and never updates the optional-analysis preference. If policies change after that check, only the explicitly reviewed versions can be written; the access gate still requires a subsequent review of newer active versions.

## Rollout boundary

The new migration retires the previous active set without overwriting its content, IDs, hashes, or historical consent references. It activates all three new documents together. Existing users will be asked to review the new set when entering policy-gated features. The frontend/backend compatibility change should be available before activating the new set.

No remote migration, production deployment, or actual user policy acceptance was performed for this change. Remote activation of this new policy version is a separate operator action. Until then, authenticated API reads continue to return the older active document text, now rendered in the corrected reader. Do not substitute new content under an old document ID/version just to make it appear immediately.

## Validation

Run from the repository root:

```text
node backend/scripts/validate-policy-documents.mjs
node backend/scripts/validate-analysis-sql.mjs
npm run test --workspace frontend
npm run test --workspace backend
npm run typecheck --workspace frontend
npm run typecheck --workspace backend
```

The policy validation uses isolated PostgreSQL/WASM with the actual existing policy table and activation function. It checks source equality, hashes, complete activation, historical preservation, and duplicate-application rollback. The analysis harness also validates the full migration chain and existing SQL security/transaction tests. These are supplemental local checks, not a claim that a Docker Supabase instance or remote production database was validated.

Browser screenshots in `artifacts/policy-review-20260831/` use an isolated temporary UI fixture with the new content and the real reader component. No real consent was submitted. The fixture route was removed after checking the layout, keyboard end navigation, acknowledgement, focus restoration, and browser error logs.

Full frontend lint has an unrelated existing `@typescript-eslint/no-this-alias` error in `frontend/src/features/buddy/view/__tests__/buddy-view.test.tsx:32`; that file was not changed. Targeted lint for the changed frontend files passes. Backend lint has warnings but no errors.

Final local verification on 31 August 2026: 300 frontend tests and 146 backend tests passed; both TypeScript checks and both production builds passed. The policy reader/update/signup subset passed all 14 tests, including keyboard navigation, short-document acknowledgement, explicit review, dismissal, version resets, and failure recovery. Five backend tests cover version-bound acknowledgement. These test totals include pre-existing uncommitted implementation work, not just this change.
