# Backend responsibility migration map

This map records the active owner for behavior removed with the modular monolith. The deleted `backend/` tree is historical and must not be restored as a runtime.

| Previous responsibility | Current owner and replacement |
|---|---|
| Public authentication middleware, request IDs, rate limits, routing | API Gateway validates Supabase access tokens, creates/preserves request IDs, signs destination-specific user context, rate-limits requests, and proxies by route table. |
| Registration, account gates, onboarding, profile, settings, consent, trusted contacts, export/deletion requests | User Service `/registration/*`, `/access/*`, `/onboarding/*`, and `/settings/*`. Pre-auth registration uses signed draft/CSRF cookies and allow-listed RPCs. Profile image bytes use private Storage through `PUT /settings/avatar`. |
| Identity verification and administrator review | User Service `/verification*` and `/admin/verifications*`, including encrypted details/documents and private Storage access. |
| Notifications and audit writes | User Service public `/notifications*` and internal `/internal/notifications` and `/internal/audit-events` APIs. No caller writes User-owned tables directly. |
| Journal CRUD, drafts, encryption/decryption | Journal Service `/journals*`; AES-256-GCM key/version compatibility remains version 1. |
| Journal analysis provider/orchestration | Analysis Service checks User verification/account consent, requests Journal-owned per-entry input, persists its own lifecycle/results, calls ML and Recommendation, and fails closed on unavailable dependencies. |
| Mood entries and PHQ-8 screening | Assessment Service `/moods` and `/assessments/phq8`. |
| Urgent-language safety signal and model loading | ML Service `/health`, `/health/ready`, `/v1/model`, and `/v1/infer`. Production inference remains unavailable until reviewed artifacts and a loader exist. |
| Buddy, grounding, and support catalog | Wellness Service. Buddy verification and audit interactions use User Service APIs. |
| Dashboard and emotion aggregation | Insights Service composes User and Journal APIs and has no database grants. |
| CBT/wellbeing/urgent-support selection | Recommendation Service, with read-only access to the verified support-resource catalog. |

## Intentional deletions and replacements

- `backend/src`, its tests, Dockerfile, package manifest, logs, and monolith workflows were deleted after every active responsibility had an independent owner.
- Model-runtime, severity, and safety behavior belongs to `ml/`; orchestration remains in `ai-service/`.
- `services-ci.yml` replaces monolith-oriented CI and validates Node services, Python services, Compose, and the database.
- The temporary `packages/contracts` workspace from the foundation increment was retired after consumer tracing confirmed active services own and validate their HTTP boundary types locally.
- Experimental service-schema migrations from the abandoned branch are not replayed. The guarded canonical ownership migration retains the hardened public tables and service-role grants.

Historical material under `plan/`, `docs/implementation/`, `docs/frontend/`, and `docs/refactoring/` is preserved as project evidence, not current runtime guidance.
