# Frontend route registry

`src/routes/index.ts` is the canonical source for commonly linked application routes.

| URL | Access | Current status |
|---|---|---|
| `/` | Public | Marketing landing page |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | Public | Supabase Auth UI and OAuth callback support |
| `/onboarding/*` | Authenticated/onboarding | Existing presentation flow; persistence integration pending |
| `/dashboard` | Protected UI | Existing mock/dashboard adapter |
| `/journal`, `/journal/new`, `/journal/[id]` | Protected | Mock by default; API-backed CRUD/analysis when `NEXT_PUBLIC_DATA_ADAPTER=http` |
| `/buddy/*` | Protected | UI retained; no production-like AI response in this phase |
| `/settings/*` | Protected | Existing UI; profile/consent/privacy API integration remains incremental |
| `/crisis-help`, `/support/find-help` | Public | Static safe-support interface; no hard-coded unverified contacts |
