# Backend responsibility migration map

This map records the replacement for behavior removed from the modular backend in commit `3c63a96`. The deleted `backend/src` tree is historical only and must not be restored as an active runtime.

| Previous modular-backend responsibility | Current owner and replacement |
|---|---|
| Public authentication middleware, request IDs, rate limits, routing | API Gateway validates Supabase access tokens, creates/preserves request IDs, signs destination-specific user context, applies rate limits, and proxies by route table. |
| Onboarding, profile, settings, consent, trusted contacts, export/deletion requests | User Service `/onboarding/*` and `/settings/*`. Signup display-name persistence now also uses Gateway → User Service. |
| Identity verification and admin review | User Service `/verification*` and `/admin/verifications*`, including encrypted details/documents and private Storage access. |
| Notifications and audit writes used by other domains | User Service internal `/notifications` and `/audit-events` APIs. No caller writes User-owned tables directly. |
| Journal CRUD, drafts, encryption/decryption | Journal Service `/journals*`; AES-256-GCM key/version compatibility remains version 1. |
| Journal analysis provider/orchestration | Analysis Service. It checks User verification plus account consent, checks Journal-owned per-entry consent through Journal API, persists Analysis-owned lifecycle rows, calls ML and Recommendation, and fails closed on unavailable dependencies. |
| Mood entries and PHQ-8 screening | Assessment Service `/moods` and `/assessments/phq8`; dashboard mood check-ins call it through Gateway. |
| PHQ-8 severity mapping formerly under AI | ML Service `severity_from_phq8`: 0–4 minimal, 5–9 mild, 10–14 moderate, 15–19 moderately severe, 20–24 severe. |
| Urgent-language safety signal formerly under AI | ML Service safety post-processing, integrated into the inference response contract and independently tested. Production inference remains unavailable until the model runtime is validated. |
| Buddy sessions/messages/history, grounding, support catalog | Wellness Service. Buddy verification and audit interactions use User Service APIs. |
| Dashboard and emotion aggregation | Insights Service, composed from User and Journal APIs with no direct table grants. |
| CBT/wellbeing/urgent support selection | Recommendation Service public/internal recommendation endpoints. |
| AI model loading, readiness, model metadata, inference contract | ML Service `/health`, `/health/ready`, `/v1/model`, and `/v1/infer`. No mock clinical inference is enabled. |

## Intentional deletions and replacements

- `backend/src`, its tests, Dockerfile, package manifest, and monolith workflows were deleted because all active responsibilities above have independent services and tests.
- Old AI runtime/model/severity/safety modules were removed from Analysis. Model-runtime ownership, severity mapping, and safety detection now live under `ml/`; orchestration remains under `ai-service/`.
- `backend-ci.yml`, `ai-service-ci.yml`, and the monolith-oriented aggregate `ci.yml` were replaced by `services-ci.yml`, with frontend and security checks retained in dedicated workflows.
- Experimental schema-per-service tables and obsolete compatibility tables are removed only by the guarded canonical ownership migration; it aborts rather than deleting non-empty data.

Historical thesis/project material under `plan/`, `docs/implementation/`, and `docs/refactoring/` is intentionally preserved as project evidence, not current runtime guidance.
