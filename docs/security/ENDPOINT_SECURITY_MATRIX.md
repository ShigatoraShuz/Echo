# Endpoint security inventory

Source snapshot: 2026-09-20. Paths are router-local under `/api/v1`; duplicate registrations are retained. This inventory does not assert complete security coverage.

| Method | Path | Router | Validation / ownership / limits / evidence |
| --- | --- | --- | --- |
| GET | /access/status | backend/src/features/access/access.routes.ts | JWT owner; access-policy/age validation; global120/min; access route tests |
| POST | /access/age | backend/src/features/access/access.routes.ts | JWT owner; access-policy/age validation; global120/min; access route tests |
| POST | /access/policies | backend/src/features/access/access.routes.ts | JWT owner; access-policy/age validation; global120/min; access route tests |
| GET | /internal/ai/protocol-health | backend/src/features/analysis/local-worker.routes.ts | Worker secret + authorized worker identity; strict body/UUID; lease/receipt/consent SQL; 60/min; worker tests |
| POST | /internal/ai/worker-health | backend/src/features/analysis/local-worker.routes.ts | Worker secret + authorized worker identity; strict body/UUID; lease/receipt/consent SQL; 60/min; worker tests |
| POST | /internal/ai/jobs/claim | backend/src/features/analysis/local-worker.routes.ts | Worker secret + authorized worker identity; strict body/UUID; lease/receipt/consent SQL; 60/min; worker tests |
| POST | /internal/ai/jobs/:jobId/heartbeat | backend/src/features/analysis/local-worker.routes.ts | Worker secret + authorized worker identity; strict body/UUID; lease/receipt/consent SQL; 60/min; worker tests |
| GET | /support-resources | backend/src/features/experience/experience.routes.ts | Public approved support directory; DTO/range review pending; global 120/min |
| GET | /dashboard | backend/src/features/experience/experience.routes.ts | JWT owner; Buddy verification/contact gates; strict body; writes20/user/min; experience/wellness tests; remaining admin client |
| GET | /wellness | backend/src/features/experience/experience.routes.ts | JWT owner; Buddy verification/contact gates; strict body; writes20/user/min; experience/wellness tests; remaining admin client |
| POST | /wellness/phq8 | backend/src/features/experience/experience.routes.ts | JWT owner; Buddy verification/contact gates; strict body; writes20/user/min; experience/wellness tests; remaining admin client |
| POST | /wellness/support-prompt | backend/src/features/experience/experience.routes.ts | JWT owner; Buddy verification/contact gates; strict body; writes20/user/min; experience/wellness tests; remaining admin client |
| GET | /buddy/session | backend/src/features/experience/experience.routes.ts | JWT owner; Buddy verification/contact gates; strict body; writes20/user/min; experience/wellness tests; remaining admin client |
| POST | /buddy/messages | backend/src/features/experience/experience.routes.ts | JWT owner; Buddy verification/contact gates; strict body; writes20/user/min; experience/wellness tests; remaining admin client |
| GET | /buddy/history | backend/src/features/experience/experience.routes.ts | JWT owner; Buddy verification/contact gates; strict body; writes20/user/min; experience/wellness tests; remaining admin client |
| GET | /insights/emotions | backend/src/features/experience/experience.routes.ts | JWT owner; Buddy verification/contact gates; strict body; writes20/user/min; experience/wellness tests; remaining admin client |
| POST | /grounding/sessions | backend/src/features/experience/experience.routes.ts | JWT owner; Buddy verification/contact gates; strict body; writes20/user/min; experience/wellness tests; remaining admin client |
| GET | /health | backend/src/features/health/health.routes.ts | Public; generic health DTO; global 120/min; health route tests |
| GET | /health/ready | backend/src/features/health/health.routes.ts | Public; generic health DTO; global 120/min; health route tests |
| GET | /journals | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| POST | /journals | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| PUT | /journals/:journalId/images/:imageId | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| GET | /analysis-jobs/:jobId/status | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| GET | /dashboard/insights | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| POST | /support-resources/resolve | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| POST | /support-contact-requests | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| POST | /buddy/handoffs | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| GET | /buddy/handoffs/:handoffId | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| POST | /analysis-jobs/:jobId/safety-review | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| GET | /journals/draft | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| PUT | /journals/draft | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| DELETE | /journals/draft | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| GET | /journals/:journalId | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| PATCH | /journals/:journalId | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| DELETE | /journals/:journalId | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| POST | /journals/:journalId/analyze | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| GET | /journals/:journalId/analyses | backend/src/features/journals/journals.routes.ts | JWT owner; UUID/body contracts; journal30/min; analysis/verification/contact/consent gates; journal SQL/API tests; full endpoint negative coverage pending |
| GET | /notifications | backend/src/features/notifications/notifications.routes.ts | JWT owner client/RLS; UUID; read_at-only grant; global120/min; notifications tests + isolation SQL |
| PATCH | /notifications/read-all | backend/src/features/notifications/notifications.routes.ts | JWT owner client/RLS; UUID; read_at-only grant; global120/min; notifications tests + isolation SQL |
| PATCH | /notifications/:notificationId/read | backend/src/features/notifications/notifications.routes.ts | JWT owner client/RLS; UUID; read_at-only grant; global120/min; notifications tests + isolation SQL |
| GET | /onboarding/status | backend/src/features/onboarding/onboarding.routes.ts | JWT owner; strict body; access guard; global120/min; onboarding tests; remaining admin client |
| POST | /onboarding/consent | backend/src/features/onboarding/onboarding.routes.ts | JWT owner; strict body; access guard; global120/min; onboarding tests; remaining admin client |
| POST | /onboarding/profile | backend/src/features/onboarding/onboarding.routes.ts | JWT owner; strict body; access guard; global120/min; onboarding tests; remaining admin client |
| POST | /onboarding/setup | backend/src/features/onboarding/onboarding.routes.ts | JWT owner; strict body; access guard; global120/min; onboarding tests; remaining admin client |
| POST | /onboarding/complete | backend/src/features/onboarding/onboarding.routes.ts | JWT owner; strict body; access guard; global120/min; onboarding tests; remaining admin client |
| GET | /registration/policies | backend/src/features/registration/registration.routes.ts | Public managed signup; origin/CSRF draft/Google proof; 12/min; registration route/enum tests |
| POST | /registration/eligibility | backend/src/features/registration/registration.routes.ts | Public managed signup; origin/CSRF draft/Google proof; 12/min; registration route/enum tests |
| POST | /registration/agreements | backend/src/features/registration/registration.routes.ts | Public managed signup; origin/CSRF draft/Google proof; 12/min; registration route/enum tests |
| POST | /registration/email | backend/src/features/registration/registration.routes.ts | Public managed signup; origin/CSRF draft/Google proof; 12/min; registration route/enum tests |
| GET | /registration/status | backend/src/features/registration/registration.routes.ts | Public managed signup; origin/CSRF draft/Google proof; 12/min; registration route/enum tests |
| POST | /registration/resend | backend/src/features/registration/registration.routes.ts | Public managed signup; origin/CSRF draft/Google proof; 12/min; registration route/enum tests |
| POST | /registration/google/nonce | backend/src/features/registration/registration.routes.ts | Public managed signup; origin/CSRF draft/Google proof; 12/min; registration route/enum tests |
| POST | /registration/google/bind | backend/src/features/registration/registration.routes.ts | Public managed signup; origin/CSRF draft/Google proof; 12/min; registration route/enum tests |
| POST | /registration/google/login-challenge | backend/src/features/registration/registration.routes.ts | Public managed signup; origin/CSRF draft/Google proof; 12/min; registration route/enum tests |
| POST | /registration/google/login-status | backend/src/features/registration/registration.routes.ts | Public managed signup; origin/CSRF draft/Google proof; 12/min; registration route/enum tests |
| POST | /registration/google/login-nonce | backend/src/features/registration/registration.routes.ts | Public managed signup; origin/CSRF draft/Google proof; 12/min; registration route/enum tests |
| GET | /settings | backend/src/features/settings/settings.routes.ts | JWT owner; scoped RLS normal data; strict writes/UUID; privacy recent-auth; sensitive routes 6/min; settings routes + isolation SQL; lifecycle incomplete |
| PATCH | /settings/profile | backend/src/features/settings/settings.routes.ts | JWT owner; scoped RLS normal data; strict writes/UUID; privacy recent-auth; sensitive routes 6/min; settings routes + isolation SQL; lifecycle incomplete |
| PUT | /settings/profile/avatar | backend/src/features/settings/settings.routes.ts | JWT owner; scoped RLS normal data; strict writes/UUID; privacy recent-auth; sensitive routes 6/min; settings routes + isolation SQL; lifecycle incomplete |
| PATCH | /settings/privacy | backend/src/features/settings/settings.routes.ts | JWT owner; scoped RLS normal data; strict writes/UUID; privacy recent-auth; sensitive routes 6/min; settings routes + isolation SQL; lifecycle incomplete |
| PATCH | /settings/notifications | backend/src/features/settings/settings.routes.ts | JWT owner; scoped RLS normal data; strict writes/UUID; privacy recent-auth; sensitive routes 6/min; settings routes + isolation SQL; lifecycle incomplete |
| POST | /settings/trusted-contacts | backend/src/features/settings/settings.routes.ts | JWT owner; scoped RLS normal data; strict writes/UUID; privacy recent-auth; sensitive routes 6/min; settings routes + isolation SQL; lifecycle incomplete |
| PATCH | /settings/trusted-contacts/:contactId | backend/src/features/settings/settings.routes.ts | JWT owner; scoped RLS normal data; strict writes/UUID; privacy recent-auth; sensitive routes 6/min; settings routes + isolation SQL; lifecycle incomplete |
| DELETE | /settings/trusted-contacts/:contactId | backend/src/features/settings/settings.routes.ts | JWT owner; scoped RLS normal data; strict writes/UUID; privacy recent-auth; sensitive routes 6/min; settings routes + isolation SQL; lifecycle incomplete |
| POST | /settings/data-exports | backend/src/features/settings/settings.routes.ts | JWT owner; scoped RLS normal data; strict writes/UUID; privacy recent-auth; sensitive routes 6/min; settings routes + isolation SQL; lifecycle incomplete |
| POST | /settings/account-deletion | backend/src/features/settings/settings.routes.ts | JWT owner; scoped RLS normal data; strict writes/UUID; privacy recent-auth; sensitive routes 6/min; settings routes + isolation SQL; lifecycle incomplete |
| PATCH | /settings/account-deletion/:requestId/cancel | backend/src/features/settings/settings.routes.ts | JWT owner; scoped RLS normal data; strict writes/UUID; privacy recent-auth; sensitive routes 6/min; settings routes + isolation SQL; lifecycle incomplete |
| PATCH | /settings/security/password | backend/src/features/settings/settings.routes.ts | JWT owner; scoped RLS normal data; strict writes/UUID; privacy recent-auth; sensitive routes 6/min; settings routes + isolation SQL; lifecycle incomplete |
| GET | /settings/security/audit-events | backend/src/features/settings/settings.routes.ts | JWT owner; scoped RLS normal data; strict writes/UUID; privacy recent-auth; sensitive routes 6/min; settings routes + isolation SQL; lifecycle incomplete |
| POST | /settings/security/sign-out-all-devices | backend/src/features/settings/settings.routes.ts | JWT owner; scoped RLS normal data; strict writes/UUID; privacy recent-auth; sensitive routes 6/min; settings routes + isolation SQL; lifecycle incomplete |
| GET | /verification | backend/src/features/verification/verification.routes.ts | JWT owner; access-policy/age validation; global120/min; access route tests |
| GET | /verification/reviewer-access | backend/src/features/verification/verification.routes.ts | JWT owner; access-policy/age validation; global120/min; access route tests |
| PUT | /verification/application | backend/src/features/verification/verification.routes.ts | JWT owner; access-policy/age validation; global120/min; access route tests |
| PUT | /verification/documents/:kind | backend/src/features/verification/verification.routes.ts | JWT owner; access-policy/age validation; global120/min; access route tests |
| POST | /verification/submit | backend/src/features/verification/verification.routes.ts | JWT owner; access-policy/age validation; global120/min; access route tests |
| GET | /admin/verifications | backend/src/features/verification/verification.routes.ts | JWT + DB reviewer role + aal2 + recent-auth; UUID/strict decision; 30/min; reviewer tests; live scanner blocked |
| GET | /admin/verifications/:verificationId | backend/src/features/verification/verification.routes.ts | JWT + DB reviewer role + aal2 + recent-auth; UUID/strict decision; 30/min; reviewer tests; live scanner blocked |
| POST | /admin/verifications/:verificationId/claim | backend/src/features/verification/verification.routes.ts | JWT + DB reviewer role + aal2 + recent-auth; UUID/strict decision; 30/min; reviewer tests; live scanner blocked |
| POST | /admin/verifications/:verificationId/decision | backend/src/features/verification/verification.routes.ts | JWT + DB reviewer role + aal2 + recent-auth; UUID/strict decision; 30/min; reviewer tests; live scanner blocked |
| GET | /support-resources | backend/src/routes/v1.routes.ts | Public approved support directory; DTO/range review pending; global 120/min |

| POST | /settings/data-exports/pdf-authorization | backend/src/features/settings/settings.routes.ts | JWT + recent-auth, sensitive limiter6/min; required PDF audit insertion; no persistent PDF artifact |
| GET | /settings/data-exports/:requestId/download | backend/src/features/settings/settings.routes.ts | JWT + recent-auth, UUID, limiter6/min; owner-bound single-use/expiry; attachment/no-store; export lifecycle and route tests |

Dynamic POST routes (all under the same worker-secret, 60/min, strict-envelope, UUID, lease and idempotency guards): `/internal/ai/jobs/:jobId/progress`, `/internal/ai/jobs/:jobId/safety-result`, `/internal/ai/jobs/:jobId/final-result`, `/internal/ai/jobs/:jobId/failure`. Payloads use versioned strict schemas. These four registrations were missed by the original literal-path inventory.

Common ordering: request ID/context/logging, Helmet, trusted origin/method/proxy checks, global limiter, bounded body parser, runtime control overlay, router auth/access checks, controller/service authorization and safe errors. Per-route presence above does not assert a real two-account integration test for every operation.
