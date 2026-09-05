# Journal analysis implementation

ECHO implements journal analysis as a synchronous microservice flow. It does not include development fixtures, a monolithic backend worker, browser-side model execution, or facial analysis.

## Request path

1. The authenticated browser sends `POST /api/v1/journals/{journalId}/analyze` to the API Gateway.
2. Analysis Service asks User Service to verify identity approval and active account-level `journal_analysis` consent.
3. Analysis Service asks Journal Service for the owner-scoped, per-entry-consented analysis input.
4. Analysis Service calls ML Inference Service and then Recommendation Service.
5. Analysis Service persists the lifecycle/result in its owned public tables and returns the result.

Every internal hop uses a target-specific token, signed user context where needed, request-ID propagation, a bounded timeout, and an explicit unavailable/timeout response. Services do not import each other's source or read each other's tables.

## Availability boundary

No reviewed model artifact or production model loader is bundled. ML liveness succeeds, but readiness and inference return `503` until valid artifacts and the evaluation manifest are supplied. Analysis propagates this failure and never fabricates a clinical score.

The output is non-diagnostic. Urgent-language processing is an independent ML safety signal, not emergency monitoring. Support resources are informational and ECHO must never be treated as a substitute for emergency or professional care.

## Validation

Run the repository gates from the root:

```bash
npm run architecture:check
npm run environment:check
npm run typecheck
npm run lint
npm test
npm run build
cd ai-service && uv run ruff check . && uv run pytest
cd ../ml && uv run ruff check . && uv run pytest
```

Database validation additionally requires a disposable local Supabase stack: `supabase db reset`, `supabase db lint`, and `supabase test db`.
