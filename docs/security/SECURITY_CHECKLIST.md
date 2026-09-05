# ECHO — Security Checklist

> HISTORICAL / SUPERSEDED / PRE-MICROSERVICES. Retained as thesis provenance, not current implementation or deployment guidance. See [microservices architecture](../architecture/microservices.md) and [testing](../testing.md) for the active system.

Status legend: `[x]` verified in this hardening pass, `[~]` partially verified / requires environment, `[ ]` open.

## Authentication
- [x] Protected resources require authentication (fail-closed, verified per route)
- [x] Invalid sessions are rejected (invalid/expired/wrong-audience tokens → 401)
- [x] Logout works correctly (sign-out + session refresh via @supabase/ssr)
- [x] No sensitive authentication information is logged
- [~] Email verification / MFA are Supabase project settings (enable before prod, H-06)
- [~] Secure password change (project setting, H-06)

## Authorization
- [x] Users cannot access/modify/delete other users' journals (RLS + service scoping + pgTAP)
- [x] PHQ data is ownership protected (RLS)
- [x] Facial results are ownership protected (RLS)
- [x] Buddy conversations are ownership protected (RLS + verified-AI gate)
- [x] Profile information is ownership protected (RLS)
- [x] Admin actions server-side gated; mass-assignment payloads stripped (ECHO-012)

## Supabase
- [x] Sensitive tables have correct RLS (journals, analyses, PHQ, emotions, risk, buddy, contacts, export/deletion requests, preferences, settings)
- [x] RLS policies follow least privilege (USING + WITH CHECK; dead tables' policies fixed, C-01/M-01)
- [x] Service-role secrets remain server-side (never in browser bundles, C-03)
- [x] Sensitive storage is private (`storage.objects` policies pinned, H-08)
- [x] Storage policies validate ownership
- [~] `db.network_restrictions` + SSL enforcement (config.toml, M-09 — infra)

## API
- [x] Inputs are validated (zod strict schemas, UUID params)
- [x] Authentication enforced (fail-closed bearer verification)
- [x] Authorization enforced (session-derived owner, admin gates)
- [x] Rate limiting: 120/min global, 20/min AI-write routes, 60/min ai-service
- [x] Request sizes bounded: 1 MiB backend (413), 64 KiB ai-service (413, chunked-proof)
- [x] CORS restricted (backend origin allow-list)
- [x] Error responses never expose internals (envelope + requestId)
- [x] Request IDs on every response

## Web
- [x] Stored XSS defense: CSP `script-src 'self' 'nonce-…'` in prod (H-02)
- [x] Nonce applied to all inline scripts (hydration, bootstrap, theme)
- [~] CSRF: SameSite=Lax cookies + bearer-token API (H-03); review before prod
- [x] CORS restricted (backend origin allow-list)
- [x] Security headers configured (CSP, X-Content-Type-Options, Referrer-Policy, HSTS, etc.)
- [x] Open redirects: safe redirect handling on `/login`

## AI Service
- [x] Shared-token auth (server-side secret)
- [x] Body-size guard bypass-proof via chunked encoding (H-07)
- [x] Rate limiting per IP with retry-after (H-07)
- [x] Readiness/model endpoints leak no device or environment details
- [x] Structured output validation (LLM output contract, T-13)
- [~] Prompt injection: no untrusted prompt injection surface in current no-LLM pipeline; gated by verified access (T-12)
- [~] AI resource limits: in-memory limiter is single-instance (documented)

## Data & Privacy
- [x] Journal logging removed (no content in logs)
- [x] PHQ logging removed
- [x] Facial image retention reviewed: no raw facial images stored; results only
- [x] Journal/PHQ content never in URLs or localStorage (dead plaintext hooks removed, M-02)
- [x] Encryption: AES-256-GCM server-side journal encryption
- [x] Export/deletion flows ownership-scoped (RLS + services)

## Infrastructure
- [x] Dependency audit performed (npm prod audit; ip-address + nanoid fixed)
- [x] Frontend `package-lock.json` in sync (M-04)
- [~] `npm audit` remaining: postcss/sharp via next@16 (breaking — pinned major, build-time only)
- [~] `uv audit` for ai-service (CI only — no uv locally)
- [~] Dockerfile export config (L-04), docker ignore updated
- [~] pgTAP execution in CI (no local Docker)

## Process
- [x] All security tests passing (backend 53, frontend 212, ai-service 9)
- [x] All gates green: lint (0 errors), typecheck, tests, production build
- [x] Final security report written (`FINAL_SECURITY_REPORT.md`)

## Open Items (deployment-time, not code)
- Email verification + MFA + secure password change (Supabase dashboard)
- Network restrictions + SSL enforcement (Supabase dashboard)
- Manual penetration testing before launch
- Production secrets rotation and rotation cadence (AI token, encryption key, service-role key)
