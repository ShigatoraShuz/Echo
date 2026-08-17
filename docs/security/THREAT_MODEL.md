# ECHO Threat Model

- Date: 2026-08-17
- Companion: [SECURITY_AUDIT.md](./SECURITY_AUDIT.md)
- Posture: Zero Trust + Least Privilege + Defense in Depth + Privacy by Design

## Trust boundaries

```
Browser (untrusted) ──HTTPS──▶ Next.js (serves UI; session validation)
                                   │  Bearer token (Supabase JWT)
                                   ▼
                              Express API (authN/authZ/validation/rate limits)
                                   │  service-role client (RLS bypassed by design)
                                   ▼
                              Supabase (Auth, PostgreSQL + RLS as defense-in-depth,
                                        private Storage)
                                   ▲
                              ai-service (internal token, future inference)
```

Primary security boundaries: **Express API** (application-level authorization) and **Supabase RLS/privileges** (database-level defense-in-depth). The browser is never trusted.

## Assets

| Asset | Location | Sensitivity |
| --- | --- | --- |
| User identity / email / display name | `profiles`, `auth.users` | High |
| Authentication sessions | Supabase Auth cookies (browser), JWTs | Critical |
| Journal entries (encrypted at rest) | `journals`, `journal_drafts` (AES-256-GCM ciphertext) | Critical |
| PHQ-8 scores / depression severity | `journal_analyses`, `analysis_windows` | Critical |
| Emotion analysis results | `journal_analyses`, `journals.emotions` | High |
| Mood history | `mood_entries` | High |
| Buddy conversations (encrypted at rest) | `buddy_conversations`, `buddy_messages` | Critical |
| Trusted contacts | `trusted_contacts` | High |
| Consent / privacy / notification preferences | `user_consents`, `privacy_preferences`, `notification_preferences`, `user_preferences` | Medium |
| Risk signals / safety events | `safety_events`, `safety_event_resources` | Critical |
| Identity verification documents + reviews | `identity_verifications`, `verification_documents` (private bucket), `verification_reviews` | Critical (identity documents) |
| Export / deletion requests | `data_export_requests`, `account_deletion_requests` | Medium |
| Audit trail | `audit_events` | Medium |
| Admin identity | `verification_admins` | High |
| API credentials | `SUPABASE_SERVICE_ROLE_KEY`, `JOURNAL_ENCRYPTION_KEY_BASE64`, `AI_SERVICE_TOKEN` | Critical |

Facial data: **not collected or stored** — facial analysis is client-side only and feature-flagged off. No raw facial images exist server-side.

## Threat actors

| Actor | Capability | Primary targets |
| --- | --- | --- |
| Unauthenticated attacker | Raw HTTP to API/frontend/Supabase | Auth bypass, public endpoints, brute force |
| Authenticated malicious user | Valid session, direct API calls | Other users' data (IDOR), privilege escalation |
| Compromised account | Stolen cookies/tokens | Journals, PHQ-8, contacts, deletion abuse |
| Bots / automated scripts | High-volume requests | Rate-limited endpoints, signup abuse, AI endpoints |
| Malicious browser scripts | XSS payloads in user content | Session theft, journal exfiltration |
| Compromised dependency | Supply chain | Code execution, data exfiltration |
| Insider / accidental admin | Elevated privileges | Data access, admin actions |

## Attack scenarios (ranked)

| # | Scenario | Attack path | Impact | Likelihood | Severity |
| --- | --- | --- | --- | --- | --- |
| T-01 | **IDOR — journal access** | GET `/api/v1/journals/:id` with another user's id | Read/modify/delete others' journals | High (ids are UUIDs, but API is the boundary) | CRITICAL |
| T-02 | **RLS bypass via policy OR** | Insert `buddy_messages` with `message_role='buddy'` + any `conversation_id` (loose duplicate policy defeats strict one) | Assistant-message spoofing, cross-user conversation writes | Medium (requires valid account) | CRITICAL |
| T-03 | **Unauthenticated journal CRUD** | Call relative `/api/v1/journals` if a proxy ever routes `/api/*` | Full journal data flow without auth | Low (no rewrite configured today) but breaks feature in `http` mode | CRITICAL |
| T-04 | **Secrets exposure** | Service-role key / encryption key / AI token leaks via `.env` baked into image, bundle, or git | Full database access | Low (gitignored; Dockerfile broken) | CRITICAL |
| T-05 | **Mass assignment** | Send `user_id`, `role`, `verificationStatus`, `requestStatus` in JSON bodies | Ownership tampering, privilege escalation | Medium (zod schemas are explicit; to be tested) | HIGH |
| T-06 | **Stored XSS** | Journal/buddy content containing `<script>`/`<img onerror>` rendered unescaped | Session theft | Low (React text rendering; no unsafe sinks) | HIGH (if introduced) |
| T-07 | **Brute force / credential stuffing** | Repeated login/reset attempts | Account compromise | Medium (global 120/min limit; Supabase-side protections apply) | HIGH |
| T-08 | **Account enumeration** | Signup/login/reset response differences | Email existence disclosure | Medium | MEDIUM |
| T-09 | **CSRF** | State-changing requests via auto-attached cookies | Unwanted actions | Low (API uses Bearer tokens, not cookies; Supabase cookies SameSite) | MEDIUM |
| T-10 | **API abuse / AI DoS** | Hammer `/journals/:id/analyze`, `/buddy/messages`; oversized/chunked bodies | Resource exhaustion, cost abuse | Medium (global limit only; no per-route limits) | HIGH |
| T-11 | **Malicious uploads** | MIME spoofing, oversized docs, path traversal | Storage abuse, malware | Low (server-side MIME/size/hash, server-generated filenames, private bucket) | MEDIUM |
| T-12 | **Prompt injection (future LLM)** | Journal text containing "ignore previous instructions" / "reveal system prompt" | Privilege boundaries, data leakage | Future (no LLM wired today) | CRITICAL (when wired) |
| T-13 | **LLM output injection (future)** | Malformed/impossible model output accepted as truth | Wrong scores, unsafe recommendations | Future | HIGH (when wired) |
| T-14 | **Sensitive logging** | Journal text / PHQ answers / tokens in logs | Data leakage | Low (redaction + metadata-only logging verified) | HIGH |
| T-15 | **Error-message leakage** | Stack traces, SQL errors, paths in responses | Reconnaissance | Low (generic 500s; body-parser errors currently 500 — see H-01) | MEDIUM |
| T-16 | **Open redirect** | `next`/`callbackUrl` params | Phishing | Low (safeRedirectPath) | MEDIUM |
| T-17 | **SSRF** | Backend fetching user-supplied URLs | Internal network access | None (only env-configured AI URL; not wired) | LOW |
| T-18 | **Caching of sensitive pages** | Journal/PHQ pages cached publicly | Data leakage | Low (`no-store` on protected segments) | MEDIUM |
| T-19 | **Sensitive data in URLs** | Journal text/PHQ answers in query strings | History/proxy leakage | None (verified) | LOW |
| T-20 | **Browser storage of PHI** | Journal text in localStorage | Local exfiltration | Low (draft hooks unused/exported — M-02) | MEDIUM |
| T-21 | **Privilege escalation (admin)** | Frontend role checks, crafted admin calls | Admin actions | Low (DB-backed `verification_admins` check) | HIGH |
| T-22 | **Dependency vulnerabilities** | Known CVEs in npm/pip deps | RCE, XSS, DoS | Medium (stale lockfile — M-04) | HIGH |
| T-23 | **Session theft via beforeunload persistence** | "Remember me" off fails to clear session on tab kill | Session persistence beyond intent | Medium | MEDIUM |
| T-24 | **Facsimile account creation** | Signup with someone else's email (no email verification) | Account confusion | Medium (config) | MEDIUM |

## Risk treatment summary

- **Accepted/verified low**: XSS (safe rendering), SSRF (no user-supplied URLs), open redirects (validated), caching (no-store), URL privacy (no sensitive params), uploads (multi-layer validation).
- **Mitigation in place but to be verified by tests**: IDOR (app-layer scoping — Phase 3/9 tests), mass assignment (explicit zod schemas — Phase 9 tests), admin escalation (DB gate — Phase 9 tests).
- **To fix**: T-02 (C-01), T-03 (C-02), T-04 (C-03/C-04), T-10 (rate limiting), T-01/T-05/T-21 (security test suite), T-24 (infra decision: enable email confirmation), T-12/T-13 (document + test the future inference boundary).
- **Documented limitations**: in-memory AI rate limiter is single-instance only (Phase 5); Supabase-side protections (email confirmation, MFA, network restrictions, SSL enforcement) require project-level configuration (FINAL_SECURITY_REPORT recommendations).
