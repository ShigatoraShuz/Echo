# Frontend routes

Next.js files under `frontend/src/app` define routes. `frontend/src/config/routes.config.ts` supplies reusable links. HTTP is the default adapter; production rejects mock mode.

| Routes | Boundary |
| --- | --- |
| `/`, `/about`, `/terms`, `/privacy-policy` | Public product and policy overviews |
| `/signup` | Gateway → User registration, versioned documents, email or nonce-bound Google signup |
| `/login`, `/admin-login`, `/forgot-password`, `/reset-password`, `/callback` | Supabase identity/session operations; reviewer authorization through User |
| `/onboarding/age`, `/onboarding/policies`, `/onboarding` | User-owned access gates and persisted preferences |
| `/dashboard`, `/insights/emotion` | Insights Service via Gateway |
| `/journal`, `/journal/new`, `/journal/[id]` | Journal CRUD/drafts; explicit analysis through Analysis Service |
| `/buddy`, `/buddy/history`, `/tools/grounding` | Wellness Service; optional browser voice controls |
| `/settings/*`, `/admin/verifications` | User settings, consent, private verification, notifications, export/deletion requests |
| `/crisis`, `/crisis-help`, `/support/find-help` | Public support pages; resources supplied by Wellness |
| `/design-system` | Development-only component gallery; production returns not found |

Frontend redirects guide account setup. Gateway independently enforces User Service access decisions for protected domain APIs. Domain services require signed user context; internal operations additionally require the target service token.
