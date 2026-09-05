# Final integration conflict resolutions

Baseline: `069afef6604a841cad79157d4e71e0585904d144`. Incoming main: `915850a63efded7a70fa03fffa48100335adee8f`.

The merge's preserved `MERGE_MSG` lists **105 unique conflict paths** (including inferred rename conflicts). The earlier working estimate of 104 was corrected by enumerating that list. No unresolved index entries remain. Each row below records the final path-level resolution; this was not a blanket ours/theirs merge.

| Conflict path | Final resolution |
| --- | --- |
| `.github/workflows/backend-ci.yml` | Removed/rejected. Obsolete monolith/combined-AI workflow; active services CI verifies each independent runtime. |
| `.github/workflows/ci.yml` | Removed/rejected. Obsolete monolith/combined-AI workflow; active services CI verifies each independent runtime. |
| `ai-service/app/schemas/analysis_request.py` | Removed/rejected. Removed combined inference/model runtime or its unused schemas/tests; Analysis orchestrates and independent ML owns inference. |
| `ai-service/app/schemas/analysis_response.py` | Removed/rejected. Removed combined inference/model runtime or its unused schemas/tests; Analysis orchestrates and independent ML owns inference. |
| `ai-service/uv.lock` | Retained independent Analysis dependency lock; verified locked isolated Ruff and pytest. |
| `backend/.env.example` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/scripts/verification-admin.mjs` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/app.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/config/__tests__/environment.test.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/config/environment.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/features/experience/__tests__/experience.service.test.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/features/experience/__tests__/mock-analysis.provider.test.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/features/experience/experience.service.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/features/journals/journals.controller.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/features/journals/journals.routes.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/features/journals/journals.service.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/features/settings/__tests__/settings.routes.test.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/features/settings/settings.routes.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/features/verification/verification.routes.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/infrastructure/analysis/analysis-provider.factory.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/infrastructure/analysis/analysis-provider.types.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/infrastructure/analysis/mock-analysis.provider.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/infrastructure/supabase/supabase-admin.client.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/routes/v1.routes.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/server.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/shared/errors/app-error.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/shared/middleware/auth.middleware.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/src/shared/types/authenticated-user.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/tests/e2e/live-integration.mjs` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `backend/tests/security/mass-assignment.test.ts` | Removed/rejected. Monolith runtime/support file not restored; legitimate behavior belongs to the independently deployed owning service. |
| `frontend/next.config.ts` | Kept architecture build/network setup; allow microphone for Buddy, no camera, Google popup-compatible COOP and security headers. |
| `frontend/src/config/environment.ts` | Kept HTTP default and service boundary; explicitly reject production mock adapters. |
| `frontend/src/features/buddy/view/__tests__/buddy-view.test.tsx` | Combined current Wellness-backed conversations and history routing with main voice input/read-aloud controls; removed fake mood/analysis handoff. |
| `frontend/src/features/buddy/view/buddy-view.tsx` | Combined current Wellness-backed conversations and history routing with main voice input/read-aloud controls; removed fake mood/analysis handoff. |
| `frontend/src/features/dashboard/view-model/use-dashboard-view-model.ts` | Retained real Insights Service-backed dashboard; rejected fake analysis/job-derived aggregates. |
| `frontend/src/features/dashboard/view/dashboard-view.tsx` | Retained real Insights Service-backed dashboard; rejected fake analysis/job-derived aggregates. |
| `frontend/src/features/journal/components/journal-analysis-panel.tsx` | Retained real Journal CRUD and Analysis HTTP boundaries; preserved explicit consent, truthful status/failure display, no fabricated risk output. |
| `frontend/src/features/landing/components/landing-how-it-works.tsx` | Preserved main landing presentation while retaining working asset imports and responsive/accessibility behavior. |
| `frontend/src/features/settings/components/avatar-upload.tsx` | Retained Gateway-backed settings/Storage boundaries; integrated supported UI, explicit canonical analysis consent, truthful export handling and removed fake/unused controls. |
| `frontend/src/features/settings/view/settings-views.tsx` | Retained Gateway-backed settings/Storage boundaries; integrated supported UI, explicit canonical analysis consent, truthful export handling and removed fake/unused controls. |
| `frontend/src/services/authentication/auth.supabase-adapter.test.ts` | Preserved session/login/reset protections; removed duplicate direct signup and migrated registration exclusively to Gateway/User. |
| `frontend/src/services/authentication/auth.supabase-adapter.ts` | Preserved session/login/reset protections; removed duplicate direct signup and migrated registration exclusively to Gateway/User. |
| `frontend/src/services/journal/journal.http-adapter.ts` | Retained real Journal CRUD and Analysis HTTP boundaries; preserved explicit consent, truthful status/failure display, no fabricated risk output. |
| `frontend/src/services/journal/journal.mock-adapter.ts` | Retained real Journal CRUD and Analysis HTTP boundaries; preserved explicit consent, truthful status/failure display, no fabricated risk output. |
| `frontend/src/services/journal/journal.service.ts` | Retained real Journal CRUD and Analysis HTTP boundaries; preserved explicit consent, truthful status/failure display, no fabricated risk output. |
| `frontend/src/services/settings/settings.mock-adapter.ts` | Removed/rejected. Unconsumed settings mock; real Settings Service is the active implementation. |
| `frontend/src/services/settings/settings.service.ts` | Retained Gateway-backed settings/Storage boundaries; integrated supported UI, explicit canonical analysis consent, truthful export handling and removed fake/unused controls. |
| `frontend/src/services/verification/verification-api.ts` | Preserved canonical User verification/Storage authorization; aligned adult eligibility and reviewer API/UI behavior. |
| `frontend/src/shared/components/crisis/crisis-support-plan.tsx` | Preserved service-backed/user-initiated support behavior; no automatic contact or mock risk dependency. |
| `frontend/src/shared/components/layout/echo-shells.tsx` | Combined main navigation/presentation with current service-backed account/auth routes; no monolith client. |
| `frontend/src/shared/components/navigation/app-profile-menu.tsx` | Combined main navigation/presentation with current service-backed account/auth routes; no monolith client. |
| `frontend/src/shared/components/navigation/echo-marketing-header.tsx` | Combined main navigation/presentation with current service-backed account/auth routes; no monolith client. |
| `package-lock.json` | Regenerated the single npm workspace lock from final manifests, then verified with clean npm ci. |
| `package.json` | Retained architecture workspaces and service verification scripts; added policy text/seed parity tests. |
| `packages/contracts/src/analysis.ts` | Removed/rejected. Retired unused transport-contract workspace (option B); boundary validation lives with actual runtime owners. |
| `packages/contracts/src/journal.ts` | Removed/rejected. Retired unused transport-contract workspace (option B); boundary validation lives with actual runtime owners. |
| `services/api-gateway/package.json` | Retained independent Gateway package/dependencies; registration routed through Gateway rather than restored backend. |
| `services/user-service/backend-dev.err` | Removed/rejected. Generated development/review output; not a product or documented thesis dependency. |
| `services/user-service/scripts/analysis-retention.mts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/scripts/journal-ciphertext-backfill.mts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/scripts/lib/verification-admin.mjs` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/scripts/validate-analysis-sql.mjs` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/scripts/validate-policy-documents.mjs` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/features/access/access-policies.test.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/features/access/access.routes.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/features/access/access.service.ts` | Reimplemented account, adult, current-policy and onboarding decisions against User-owned canonical tables; Gateway enforces the decision. |
| `services/user-service/src/features/analysis/analysis-maintenance.service.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/features/analysis/local-worker.routes.test.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/features/analysis/local-worker.routes.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/features/analysis/local-worker.service.test.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/features/analysis/local-worker.service.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/features/journals/__tests__/ciphertext-backfill.service.test.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/features/journals/__tests__/journal-analysis.routes.test.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/features/journals/__tests__/journal-submission.service.test.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/features/journals/ciphertext-backfill.service.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/features/notifications/notifications.routes.test.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/features/notifications/notifications.routes.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/features/notifications/notifications.service.ts` | Reimplemented owner-scoped list/read/create operations in User Service; no worker-job/schema-specific dependency. |
| `services/user-service/src/features/onboarding/onboarding.service.ts` | Preserved canonical profiles.id ownership; persisted/retrieved goals, tone, check-in time, mood and profile preferences; removed stale consent path. |
| `services/user-service/src/features/registration/__tests__/registration.google-cookies.test.ts` | Ported nonce/policy/CSRF/email behavior to User Service, restricted RPCs, target Gateway routing, and canonical public registration tables; retained/adapted tests. |
| `services/user-service/src/features/registration/__tests__/registration.google-nonce.test.ts` | Ported nonce/policy/CSRF/email behavior to User Service, restricted RPCs, target Gateway routing, and canonical public registration tables; retained/adapted tests. |
| `services/user-service/src/features/registration/__tests__/registration.policy.test.ts` | Ported nonce/policy/CSRF/email behavior to User Service, restricted RPCs, target Gateway routing, and canonical public registration tables; retained/adapted tests. |
| `services/user-service/src/features/registration/__tests__/registration.routes.test.ts` | Ported nonce/policy/CSRF/email behavior to User Service, restricted RPCs, target Gateway routing, and canonical public registration tables; retained/adapted tests. |
| `services/user-service/src/features/registration/registration.routes.ts` | Ported nonce/policy/CSRF/email behavior to User Service, restricted RPCs, target Gateway routing, and canonical public registration tables; retained/adapted tests. |
| `services/user-service/src/features/registration/registration.service.ts` | Ported nonce/policy/CSRF/email behavior to User Service, restricted RPCs, target Gateway routing, and canonical public registration tables; retained/adapted tests. |
| `services/user-service/src/features/settings/__tests__/settings.service.avatar.test.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/features/settings/__tests__/settings.service.password.test.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/features/settings/settings.controller.ts` | Retained Gateway-backed settings/Storage boundaries; integrated supported UI, explicit canonical analysis consent, truthful export handling and removed fake/unused controls. |
| `services/user-service/src/features/settings/settings.service.ts` | Retained Gateway-backed settings/Storage boundaries; integrated supported UI, explicit canonical analysis consent, truthful export handling and removed fake/unused controls. |
| `services/user-service/src/features/verification/__tests__/verification-admin-security.test.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/features/verification/verification.service.ts` | Preserved canonical User verification/Storage authorization; aligned adult eligibility and reviewer API/UI behavior. |
| `services/user-service/src/infrastructure/analysis/analysis-state-machine.test.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/infrastructure/analysis/analysis-state-machine.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/infrastructure/analysis/development-analysis.runner.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/infrastructure/analysis/facial-analysis-provider.types.ts` | Removed/rejected. Unsupported facial-analysis or mock-preview feature; not part of production HTTP analysis. |
| `services/user-service/src/infrastructure/idempotency/idempotency.service.test.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/infrastructure/idempotency/idempotency.service.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/infrastructure/supabase/database.types.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/infrastructure/supabase/resilient-fetch.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/infrastructure/supabase/supabase-diagnostics.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/shared/middleware/request-context.middleware.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/src/shared/request-context.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/tests/infrastructure/resilient-fetch.test.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `services/user-service/tests/verification-admin-provisioning.test.ts` | Removed/rejected. Superseded or unconsumed integration artifact; removed after repository usage tracing. |
| `supabase/config.toml` | Retained canonical public API schema exposure and enabled local email confirmation; no service-schema exposure restored. |
