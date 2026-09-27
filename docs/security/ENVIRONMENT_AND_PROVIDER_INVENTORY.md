# Environment and provider inventory

Reviewed 2026-09-17. Configuration inspection does not prove deployed controls.

| Boundary | Observed configuration / responsibility | Release evidence required |
| --- | --- | --- |
| New non-production Supabase | Root/backend/frontend URLs match masked ref `lruc…qjop`; architecture status identifies it as the new project | Owner classification, deployed schema/grant/storage snapshots and synthetic integration tests |
| Legacy Supabase | Explicitly forbidden; never contacted | No operations permitted |
| Local database | PGlite synthetic migration/test harness; no live data | Supplement with real Supabase/PostgREST/storage tests |
| Staging/production | Separate credentials, buckets, encryption and provider keys required | Inventory and owner approval unavailable; production prohibited |
| Supabase Auth / Google OAuth | Managed auth and Google identity-token registration | MFA, recovery, password policy, session lifetime and provider configuration evidence |
| Supabase database/storage | Service schemas; private verification and journal-image buckets | TLS, backup, grants/RLS and signed-access review |
| Internal FastAPI / analysis worker | Separate inference process; disabled/stub/local-worker modes | Model provenance, consent-at-execution, internal TLS and access restriction |
| External generative AI | No production provider approval established | Contract, training/retention/region/deletion review before enabling |
| Browser MediaPipe assets | Browser facial processing and model downloads | Exact destination/version inventory and network capture |
| Logging / monitoring | Console metadata and database audit records | Restricted collector, append-only retention, alert destinations and drill |

`node scripts/security-project-target.mjs` checks local URL and optional CLI link consistency without printing keys or contacting any project. Remote operations require this check, owner confirmation of non-production classification, an explicit project ref and a successful dry run. Do not use `db reset` remotely. Missing link metadata is reported as absent, never guessed or repaired by contacting another project.

Keys remain in ignored local environment files for development only. Production requires a managed secret store, separate encryption/signing keys, and verified frontend bundle scanning. No live key rotation was performed.
