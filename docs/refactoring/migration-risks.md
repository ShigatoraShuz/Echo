# Migration risks

> HISTORICAL / SUPERSEDED / PRE-MICROSERVICES. Retained as thesis provenance, not current implementation or deployment guidance. See [microservices architecture](../architecture/microservices.md) and [testing](../testing.md) for the active system.

| Risk | Impact | Mitigation | Current state |
| --- | --- | --- | --- |
| Working UI changes are uncommitted | High | Add only isolated files; do not reset, stash, or move active assets | Mitigated |
| Broken Next.js imports or routes | High | Preserve `src/app` route groups and run typecheck/build after each frontend migration | Pending per feature |
| Asset path regression | High | Reference-search every asset before moving; visual-check landing and auth afterward | Deferred |
| Incorrect Supabase RLS | Critical | Use ownership predicates, `TO authenticated`, and both `USING`/`WITH CHECK` for updates | Migration scaffolded, not applied |
| Data API exposure changes | High | Do not rely on public Data API access; backend owns protected data operations | Addressed in architecture |
| Service-role key exposure | Critical | Backend-only environment variable; no `NEXT_PUBLIC_` service key | Addressed in examples |
| Unsafe model output | Critical | AI endpoint remains unavailable until a validated artefact and deterministic runtime are supplied | Addressed in scaffold |
| Sensitive logs | Critical | Redact tokens and journal-text keys; do not write raw request bodies to logs | Addressed in backend scaffold |
| Root workspace breaks frontend installs | Medium | Keep `frontend/package-lock.json`; validate frontend commands after workspace setup | Pending verification |
| Docker/CLI unavailable locally | Low | Commit portable configuration; record that Docker, Supabase CLI, and uv are not installed on this machine | Documented |
