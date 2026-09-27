# Roles, permissions and schema ownership

Review: 2026-09-20. No production permission review has occurred.

| Actor | Allowed operations | Enforcement | Explicit denial |
| --- | --- | --- | --- |
| Anonymous browser | Public directory, health, managed registration/auth | Router inventory, registration limits, Supabase Auth | Private schemas and protected API routes |
| Authenticated user | Own journals, settings, contacts, notifications, permitted Buddy/wellness | Verified token, live session, owner filters; settings, notifications, journal content, Buddy/history and account-status reads also JWT RLS | Other owners; role/state assignment; review decisions |
| Reviewer/admin | Review identity records and clean documents | Backend DB role lookup plus aal2 and authentication within 10 minutes | Ordinary users, stale assurance, quarantined documents |
| Analysis worker | Claim/complete authorized queued jobs | Worker authentication, job/consent/status checks, kill switch | Arbitrary tool actions or role changes |
| Backend administrative client | Provisioning, credential revocation, workflow transitions, storage signing, audit insertion | Server-only import and explicit adapters | Frontend imports; audit mutation |
| Migration operator | Forward schema migrations only on verified target after dry run | security-project-target.mjs and security-migrate.mjs | Legacy project, remote reset, unreviewed production execution |
| CI | Read source; build/test synthetic data | contents:read; deterministic install | Production secrets/remote mutation during PR checks |

Administrative-client exception inventory: server.ts still injects service-role into JournalService, ExperienceService/WellnessService, VerificationService, OnboardingService, AccessService and RegistrationService. Notifications use a verified user client. Journal content/draft reads, Buddy history, dashboard/grounding history and account/onboarding status also use a verified user client. Background journal workers use a separate administrative service instance. Settings uses a verified user client for normal data operations, retaining admin access for append-only audit, credential/session changes, controlled privacy workflow transitions and avatar storage. This is an incomplete least-privilege migration, not an accepted risk. Broad remaining service-role use blocks release.

| Module | Owned schemas / data | Cross-module contract |
| --- | --- | --- |
| Registration/access/onboarding/settings | user_service; auth_provisioning for policy/provisioning | AccessService and settings trusted-contact guard; remaining arbitrary cross-schema reads must be extracted |
| Journals | journal_service, journal-images | JournalService title/list/analysis methods |
| Experience / Buddy | buddy_service | ExperienceService; local reply generation |
| Verification | verification_service, verification-documents | VerificationService access gate/review workflow |
| Notifications | notification_service | NotificationService; JournalService title resolver |
| Grounding/wellness | grounding_service and public wellness tables | WellnessService |
| Insights | insights_service and public projections | Existing journal/experience read models |
| Analysis | ai_analysis and public analysis projections | Analysis provider/worker interfaces |

Bearer API authentication is separate from browser Supabase session cookies. The browser uses @supabase/ssr cookie-backed sessions accessible to its SDK; these are not asserted HttpOnly. OAuth callback, cookie attributes and CSRF must be inspected on the authorized staging deployment. XSS protection is therefore essential. Recent authentication uses signed amr timestamps, never token refresh iat. Reviewer TOTP enrollment/challenge UI is provided; MFA provider activation is an external configuration dependency.

The account export service is a narrowly inventoried administrative exception: fixed-schema snapshot function with explicit owner predicates (including parent joins for five collections), encryption before storage, bounded private file reads, and atomic single-use download. Browser roles cannot invoke any export RPC or read artifact rows directly. Backend recent-authentication gates apply to both generation and download.
