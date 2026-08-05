# Unresolved items

1. Docker Desktop's engine is unavailable, so `supabase db reset`, pgTAP, type generation, and local end-to-end database verification remain unexecuted.
2. Existing legacy plaintext journal/mood records need a separately approved backfill and removal migration. The new backend does not write them.
3. Settings, onboarding, dashboard, privacy requests, contacts, notifications, and Buddy UI remain connected to their existing presentation/mock flows; only the existing journal feature received API integration in this incremental pass.
4. FastAPI/model integration is explicitly deferred. `ai-service/` is retained but not part of the local compose stack or backend runtime.
5. Playwright E2E is not configured in the frontend; no E2E result is claimed.
6. The existing untracked `backend/.env` still contains prior AI-service variables and must be updated locally with `JOURNAL_ENCRYPTION_KEY_BASE64`, `JOURNAL_ENCRYPTION_KEY_VERSION`, `ANALYSIS_PROVIDER=mock`, and `ALLOW_MOCK_ANALYSIS=true` before starting the new backend path. It was not edited because it may contain user secrets.
