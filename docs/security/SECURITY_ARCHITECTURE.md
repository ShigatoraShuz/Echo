# ECHO — Security Architecture

## System Layout

```text
Browser (Next.js SPA)
   │
 HTTPS (TLS at the platform edge)
   ↓
Next.js (frontend)
   ├── nonce-based CSP enforced by middleware (prod: no unsafe-inline)
   ├── SameSite=Lax + Secure (prod) session cookies via @supabase/ssr
   ├── Server Components fetch Supabase data directly (RLS-scoped)
   └── client adapters call backend through createApiClient (bearer token)
        │
        ├──→ Backend (Express + Fastify-less Node)  :4000
        │       ├── request-id middleware (x-request-id on every response)
        │       ├── 1 MiB body limit → 413 PayloadTooLargeError (chunked-proof)
        │       ├── malformed JSON → 400 ValidationError envelope
        │       ├── global rate limit 120/min/IP; 20/min on AI write routes
        │       ├── Supabase access-token verification (fail-closed 401)
        │       ├── verified-AI gate on /buddy/* (403 until approved)
        │       ├── zod validation on every body/param (strict, strips unknown)
        │       └── envelope: data | error {code, message, details}, meta.requestId
        │            │
        │            └──→ AI Service (FastAPI) :8000
        │                    ├── shared-token auth (server-side secret)
        │                    ├── 64 KiB body guard, chunked-encoding-proof
        │                    ├── per-IP sliding-window rate limit (60/min, in-memory)
        │                    ├── structured output validation
        │                    └── no user data in logs; readiness leaks nothing
        │
        └──→ Supabase
                ├── Auth (Supabase GoTrue)
                ├── PostgreSQL + RLS (row-level ownership isolation)
                ├── private storage (ownership-validated policies)
                └── no client-side service-role access
```

## Defense Layers

| Layer | Control |
| ----- | ------- |
| Transport | TLS at edge; HSTS via `Strict-Transport-Security` |
| Edge (Next middleware) | Nonce-based CSP, security headers on every route incl. redirects |
| Session | `@supabase/ssr` cookies: SameSite=Lax, Secure (prod), Path=/; no tokens in URLs |
| API | Bearer verification (fail-closed), request size bounds, rate limits, request IDs |
| Validation | zod strict parsing: unknown/privileged fields stripped (mass-assignment defense) |
| Authorization | Session-derived `userId` (never client-supplied); admin gates server-side |
| Database | RLS on every sensitive table; `USING` + `WITH CHECK` on writes; least-privilege roles |
| Storage | `storage.objects` policies pinned in migrations; ownership validated |
| AI | Token-gated, body-size guard, rate limiting, structured output validation, no prompt context from untrusted sources |
| Crypto | AES-256-GCM journal encryption with unique IVs (server-side key) |
| Errors | Envelope with `meta.requestId`; stack traces and internals never leaked |
| Logging | No journal/PHQ/message content, no tokens; seeded request IDs only |

## Threat-Model Coverage

See `THREAT_MODEL.md` (T-01…T-24) and `SECURITY_AUDIT.md` (C-01…L-07) for the finding registry. All P0/P1 findings are remediated; residual items are listed in `FINAL_SECURITY_REPORT.md` §11.