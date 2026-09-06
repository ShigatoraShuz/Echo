# ECHO application feature completion

Implementation review: 6 September 2026. The integrated microservice architecture remains authoritative. This report describes repository implementation and automated verification; it does not claim a deployed database, delivered email, working telephone call, or browser end-to-end run.

## Recurring PHQ-8 and login

Assessment Service owns public.phq8_assessments. Columns: UUID id; auth user UUID with cascading deletion; exactly eight integer answers (0–3, no nulls, one-dimensional and one-based); score 0–24 constrained to the answer sum; the existing five-value severity enum; UTC completed_at. An index on (user_id, completed_at descending) supports history. RLS is enabled, browser grants are revoked, and assessment_service_role owns the table.

The canonical Assessment scorer validates answers, computes total and severity, and persists before returning success. Status is due for a first assessment, or when now reaches latest completion plus PHQ8_INTERVAL_DAYS. Default 7; set 3 in the Assessment environment to change the interval. Frontend scheduling uses the status response without reimplementing the rule. History returns the latest 100 owner-scoped assessments.

All public application paths below have the /api/v1 prefix:

| Method | Route | Owner / behavior |
| --- | --- | --- |
| GET | /assessments/phq8/status | Assessment: due, latest completion and next due |
| POST | /assessments/phq8 | Assessment: validate, score, save; 201 saved result |
| GET | /assessments/phq8/history | Assessment: authenticated user's history |
| GET | /access/features | User: canonical feature policy |
| GET, PUT, DELETE | /journals/draft | Journal: current encrypted draft lifecycle |
| POST | /journals/draft/:draftId/submit | Journal: atomic, idempotent finalization |
| GET, POST | /journals/draft/:parentId/attachments | Journal: owner-scoped draft media |
| GET, POST | /journals/:parentId/attachments | Journal: owner-scoped journal media |
| DELETE | /journals/attachments/:attachmentId | Journal: remove private bytes and metadata |
| POST | /journals/:journalId/analyze | Analysis: gated, consented inference and safety evaluation |
| GET | /journals/:journalId/analyses | Analysis: latest state and unacknowledged support event |
| POST | /analysis/support/:eventId/acknowledge | Analysis: owner-scoped support acknowledgment |

Normal sign-in lands on Dashboard. After Dashboard initialization, LoginExperience welcomes once per authenticated Supabase session ID. It reads server due status, requires all eight answers when due, and advances only after a successful persisted result. It refreshes Dashboard after completion. Session storage plus an in-memory fallback prevents Welcome repetition. Navigation does not re-open a completed assessment. The optional AI introduction describes consent, privacy, non-diagnostic output and temporary model unavailability, with an explicit journal-selection CTA and Not now. It never starts inference automatically. Crisis resources, emergency numbers and logout remain accessible from required check-in and status-error dialogs.

## Verification and trusted support

User Service's featurePolicy is the shared authority for canUseAiFeatures, canUseBuddy, verificationStatus, hasTrustedContact and missingRequirements. Both an unexpired approved verification and a valid acknowledged trusted_contacts entry are required. Valid contacts need a name, relationship and email or a readable phone containing 7–15 actual digits. Legacy invalid records do not unlock access.

Existing internal verification/analysis-access checks call this policy. Wellness checks it before Buddy operations; Analysis checks it before journal access/inference, and also requires account-level and per-journal analysis consent. Failures propagate FEATURE_REQUIREMENTS_NOT_MET with missingRequirements. The frontend offers verification/contact setup links and describes unavailable checks separately from missing setup.

Trusted Support Contacts settings preserve add/edit/remove and primary contact selection, explain that ECHO never contacts people automatically, and warn that removing the last contact disables Buddy and AI Analysis. Failed saves retain entered details. Ownership remains in existing User Service queries; no guardian table was added.

## Safety and support

The shared frontend safety contract is {kind: none | immediate | professional_support, eventId?}. Existing urgent-language flags from ML/Analysis and Buddy produce immediate support, independently of any PHQ total. Crisis support appears prominently in a native dialog with NCMH/In Touch call actions, emergency 911, professional resources, trusted contact actions and grounding. No diagnostic statement or automatic contact is made.

An urgent Analysis result bypasses the Recommendation dependency. If result or safety-event persistence fails after the urgent signal is observed, the response still carries immediate support and truthfully marks an unsaved analysis as failed without a score. Buddy likewise provides urgent support with explicit save-uncertainty wording if persistence fails after detection.

Repeated severity is a product heuristic: the latest three distinct journals with completed analyses must all be severe within 14 days. Failed, old and future results do not count; a lower recent severity breaks the streak; multiple analyses of one journal do not inflate it. Current categories remain minimal, mild, moderate, moderately_severe and severe. Configuration belongs to Analysis Service:

- ALARMING_ANALYSIS_STREAK_THRESHOLD=3
- ALARMING_ANALYSIS_WINDOW_DAYS=14
- SUPPORT_MODAL_COOLDOWN_DAYS=7

A streak produces dismissible professional support, with professional/resource/trusted links and Buddy grounding only when eligible. Existing Analysis-owned safety_events store source, rule, journal and analysis association. A persisted seven-day cooldown suppresses repeated streak events; event acknowledgment and local event-ID deduplication suppress repeated rendering. Immediate signals take precedence and bypass that cooldown. Crisis dialogs require explicit acknowledgment rather than Escape dismissal. Nonurgent support allows Escape / Not now. Native dialogs provide browser focus trapping, background inertness, labeled headings, focus restoration, scrolling and mobile sizing. No new animation is required for these dialogs.

## Verified resource directory

The structured support_resources migration and a tested offline JSON snapshot contain 16 phone records. Superseded rows are deactivated rather than deleted, preserving historical safety references. Sources were reviewed on 2026-09-06; lastVerifiedAt records document review, not a test call. Both crisis routes use one CrisisSupportPlan. The directory filters emergency, crisis and outpatient contacts; phone links use tel:.

| Provider | Phone contacts | Availability / classification |
| --- | --- | --- |
| NCMH | 1553; 0917-899-8727; 0966-351-4518; 0908-639-2672; 0919-057-1553 | 24/7 crisis |
| HOPELINE PH | (02) 8804-4673; 0917-558-4673; 0918-873-4673; 2919 | Globe/TM toll-free short code where supported; hours not asserted |
| In Touch Community Services | +63 2 8893-7603; 0919-056-0709; 0917-800-1123; 0917-108-5412 | 24/7 crisis |
| Philippine Red Cross | 143 | Emergency hotline; never mislabeled 2919 |
| Cavite Center for Mental Health | Admin (046) 419-0125; OPD (046) 419-0013 | Mental-health facility / outpatient, not labeled 24/7 |

Cavite address: #38 Indang-Trece Road, Brgy. Luciano, Trece Martires City, Cavite. Confirm outpatient hours with the facility.

Source review: [NCMH public advisory](https://ncmh.gov.ph/images/pdf/docs/ncmhcovid19publicadvise5.pdf), [PIA current NCMH listing](https://pia.gov.ph/news/luzon/doh-mental-health-programs-crisis-hotlines-available-this-undas/), [DepEd HOPELINE listing](https://www.deped.gov.ph/2021/11/08/deped-launches-mental-health-helpline-system-for-learners-teachers/), [In Touch](https://in-touch.org/), [Red Cross](https://redcross.org.ph/contact-us/), [Cavite directory](https://cavite.gov.ph/home/wp-content/uploads/2022/03/40-DIRECTORY-OF-OFFICES_401-to-404.pdf), [Cavite facility address](https://cavite.gov.ph/home/wp-content/uploads/2022/04/04-2022-Chicha-CCMH.pdf). Some official contact publications are older; availability was not confirmed by placing calls. An unavailable live resource API uses the dated snapshot and says so.

## Authentication

Email registration preserves the existing eligibility, policy review, reservation and User Service/Supabase architecture. Supabase confirmation remains enabled. The confirmation template uses Supabase's token hash and the server callback verifies it through verifyOtp(type=email); it clears the temporary confirmation session and redirects to the normal code sign-in page. Invalid/expired confirmation fails closed without copying credentials into redirects.

Email sign-in uses supported passwordless Supabase email OTP, not simulated two-factor authentication. signInWithOtp(shouldCreateUser=false) sends the code without opening a session; verifyOtp establishes a session only after the six-digit code succeeds. The UI has resend, a 60-second cooldown, numeric one-time-code autocomplete, loading and invalid/expired error states. Configured expiry is 600 seconds. No application OTP table, plaintext OTP storage or OTP logging was introduced. Gateway verifies the JWT with Supabase, requires confirmed email, and permits OTP/OAuth authentication methods rather than password-only sessions.

Google keeps its existing OAuth/PKCE and registration onboarding flow, with no extra email code. Safe local redirect handling remains. Existing password recovery is retained for account management; password-only production sign-in UI and unload-based remember-me cleanup were replaced. The mock adapter truthfully reports email-code delivery unavailable.

Hosted Supabase must be configured separately: enable confirmations; copy both templates; set the real site URL and callback allowlist; configure production SMTP/delivery and rate limits; retain Google OAuth credentials and callback settings. Repository config applies to local Supabase only. No hosted auth configuration or mail delivery was changed/tested here.

## Journal media, history and drafts

Journal Service stores metadata in public.journal_attachments: UUID id/user, exactly one journal_id or draft_id, unique storage_path, MIME, size, bigint display order and created_at. Foreign keys cascade; an ownership trigger checks parent ownership and user-prefixed paths. journal_service_role owns metadata. Browser roles have no table access.

Private bucket journal-images accepts JPEG, PNG and WebP up to 5 MB. Gateway and Journal bound raw uploads; Journal validates MIME and signatures, checks signed-user ownership, and writes private bytes using JOURNAL_STORAGE_KEY. This JWT assumes journal_storage_role, a NOBYPASSRLS Storage identity restricted by policies to journal-images with select/insert/delete only. It is distinct from the Journal database key and User verification Storage key. Frontend receives 300-second signed URLs, not bucket credentials. Failed metadata writes clean up uploaded objects; explicit attachment/journal/draft deletion removes private objects through Journal. Text remains usable when preview signing is unavailable. Journal image bytes are never sent to inference or embedded as base64 journal text. Existing authenticated encryption remains unchanged.

History defaults to responsive editorial diary cards with large dates, mood/status chips, excerpts, varied card heights and meaningful image covers, plus loading and empty states. Existing filters and pagination remain; Journal fetches owner-scoped encrypted rows in database batches before decrypting/searching/paginating, avoiding silent truncation at the PostgREST row limit. Card clicks open the full journal.

/journal/drafts lists the user's existing single active draft, consistent with the unique-user journal_drafts architecture. It shows last edit, preview, media, Resume and Delete. The editor first loads the current draft, then permits text/mood/tags/consent editing, private upload/removal, explicit Save draft and Submit reflection. Loading/save/upload errors are visible. Unfinished text is encrypted by the existing Journal mechanism.

The security-invoker finalize_journal_draft RPC locks the owner draft, copies encrypted columns, converts text-array tags/emotions to journal JSON, transfers attachment references, deletes the draft and returns the journal in one transaction. journals.source_draft_id is a unique durable retry key. Cross-user finalization returns no row. A lost submission response can be retried with the same draft ID without creating another active draft or duplicate journal; editor mutations stay locked while its submission outcome is pending.

## Migrations and security regression coverage

Forward migrations:

- supabase/migrations/20260906010000_application_features.sql — PHQ, media, restricted Storage identity, transactional finalization and ownership trigger.
- supabase/migrations/20260906020000_verified_support_resources.sql — source-reviewed hotline records.

New pgTAP file has 32 assertions: table ownership/grants, browser and cross-service denial, Storage confinement, private size-limited bucket, PHQ invalid values/sum, cross-user attachment and draft denial, ciphertext/media transfer and finalization retry. Its fixtures and registration-enforcement override are transactional and rolled back. This file was reviewed but not executed because Supabase CLI/Docker are absent.

Added or updated executable coverage includes PHQ validation/scheduling/persistence/owner API, approved/unverified/contact gates, Buddy and Analysis server enforcement, image format/size/cross-user checks/private signing/failed-write cleanup, encrypted journal existing regressions, draft resume/failed read/lost-response retry, registration confirmation, Google callback, OTP expired/invalid/resend handling, Welcome session behavior, failed PHQ saves, urgent support despite dependency failures, streak windows/distinct journals/override/cooldown, frontend event deduplication, and offline-hotline migration consistency.

## Validation results

Final automated totals (no skipped application tests):

| Suite | Passed tests |
| --- | ---: |
| Root architecture/policy/resource scripts | 9 |
| Frontend (71 files) | 301 |
| API Gateway | 36 |
| Assessment | 23 |
| Insights | 2 |
| Journal | 24 |
| Recommendation | 4 |
| User | 62 |
| Wellness | 13 |
| JavaScript total | 474 |
| Analysis Python | 32 |
| ML Python | 18 |
| Combined executed total | 524 |

Commands run:

- npm ci — passed (675 packages installed; audit reported one moderate advisory; no unrelated dependency upgrade).
- npm run architecture:check — passed. The checker now distinguishes Buffer.from/Array.from byte fixtures from database table access, with a regression test.
- npm run environment:check — passed; new secret placeholders blank and scoped to their owning service.
- npm run typecheck — passed across workspaces.
- npm run lint — passed.
- npm run test — passed; totals above.
- npm run build — passed, including optimized Next.js production build and TypeScript services.
- In ai-service: uv run --isolated --locked ruff check .; uv run --isolated --locked pytest -p no:cacheprovider — passed, 32 tests.
- In ml: uv run --isolated --locked ruff check .; uv run --isolated --locked pytest -p no:cacheprovider — passed, 18 tests.
- powershell -NoProfile -ExecutionPolicy Bypass -File scripts/finalize-architecture.ps1 — passed.
- git diff --check — passed.
- Docker compose config/build — not run: Docker unavailable.
- Local Supabase migrations, db lint and pgTAP — not run: Supabase CLI and Docker unavailable.

The Python suites emit an upstream FastAPI/Starlette test-client deprecation warning. JSdom reports unsupported full-document navigation in auth tests; the assertions pass. Browser plugin discovery returned no connected browsers, so no browser interaction, screenshots, mobile rendering, native focus-trap or real signed-URL delivery was verified here. Native dialog behavior and JSX are covered by component checks, not claimed as real-browser accessibility certification.

## Semantic review and deployment boundaries

Code paths traced: email signup/confirmation/code login; Google auth/onboarding; Dashboard initialization/Welcome/due/completion; contact and verification setup; Buddy and Analysis gates; encrypted draft save/resume; image upload/removal; atomic submission and retry; history preview/detail; optional inference; streak and immediate escalation; support acknowledgment and tel actions. Review fixes included missing confirmation-token handling, stale crisis-help content, array-to-JSON finalization, save-response retry duplication, pagination truncation, invalid legacy phone acceptance, unavailable-image handling, lost urgent responses during persistence failures, and preserving failed contact edits.

Architecture checks confirm no backend monolith, frontend protected-table access, frontend service secrets, cross-service source imports or broad Storage grants were added. Recommendation remains read-only. User verification Storage and Journal encryption remain isolated.

Deployment follow-up requires applying the forward migrations to a tested local stack first, generating/configuring the restricted Journal Storage JWT, setting service environments, and validating hosted SMTP/OAuth, database/Storage grants, actual signed image delivery and available ML artifacts. No production database operation, automatic contact, telephone call, email to a third party, or deployment was performed. Signed URLs expire after five minutes; reopening/reloading fetches new URLs. Document review cannot guarantee a provider's real-time call availability. Safety detection retains the existing ML and Buddy signal limitations and is not an emergency monitoring service.

## Cleanup and files

Replaced obsolete password-only production sign-in/admin UI, unsaved optional PHQ placement and the old crisis-help hotline implementation. Removed the inert editor options button and unused reset/autosave retry methods. No existing tracked files were deleted; no unrelated dependencies were removed.

Created files:

- ai-service/app/core/safety.py
- ai-service/tests/test_safety.py
- ai-service/tests/test_support_persistence.py
- frontend/src/app/(auth)/callback/route.test.ts
- frontend/src/app/(protected)/journal/drafts/page.tsx
- frontend/src/features/dashboard/components/login-experience.test.tsx
- frontend/src/features/dashboard/components/login-experience.tsx
- frontend/src/features/journal/components/journal-images.tsx
- frontend/src/features/journal/view-model/use-journal-editor-view-model.test.ts
- frontend/src/features/journal/view/journal-drafts-view.tsx
- frontend/src/services/journal/journal-media.ts
- frontend/src/services/support-resources/verified-resources.json
- frontend/src/services/verification/feature-policy.ts
- frontend/src/shared/components/crisis/safety-response.tsx
- frontend/src/shared/components/crisis/safety-signal.test.ts
- frontend/src/shared/components/crisis/safety-signal.ts
- frontend/src/shared/components/crisis/trusted-support.tsx
- scripts/support-resources.test.mjs
- services/assessment-service/src/persistence.test.ts
- services/journal-service/src/attachments.test.ts
- services/journal-service/src/attachments.ts
- services/user-service/src/features/settings/contact-validation.ts
- services/user-service/src/features/verification/feature-policy.test.ts
- services/wellness-service/src/feature-gate.test.ts
- supabase/migrations/20260906010000_application_features.sql
- supabase/migrations/20260906020000_verified_support_resources.sql
- supabase/templates/confirmation.html
- supabase/templates/sign-in-code.html
- supabase/tests/database/application-features.test.sql
- docs/application-feature-completion.md

## Git delivery

Work stays on refactor/backend-architecture-stabilization, using its existing origin upstream. No merge into main or history rewrite. The implementation is committed and pushed only after validation. The delivery response records the resulting commit SHA and final working-tree status; the commit can also be identified with git log -1 on this branch.
