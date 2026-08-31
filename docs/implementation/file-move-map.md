# File move map

> Historical pre-microservices plan. Paths and decisions below are not active implementation guidance; see [`docs/architecture/responsibility-migration.md`](../architecture/responsibility-migration.md).

No files are moved or deleted in this phase. Existing feature directories already provide a safer incremental boundary than a broad rename.

| Current path | Target path | Reason | Import impact | Risk |
|---|---|---|---|---|
| `frontend/src/features/journal/services/journal.http-adapter.ts` | Same path | Implement the existing backend adapter rather than replace the view model. | None outside the existing factory. | Low |
| `backend/src/config/environment.ts` | Same path | Replace future-AI required settings with mock-provider-safe validation. | Backend startup only. | Medium |
| `backend/src/infrastructure/ai/` | Retained, unused/deferred | The previous future FastAPI boundary is not deleted during this non-AI phase. | None when new provider factory is used. | Low |
| `ai-service/` | Retained, documented as deferred | The brief prohibits real AI integration; no destructive removal is necessary. | None. | Low |
