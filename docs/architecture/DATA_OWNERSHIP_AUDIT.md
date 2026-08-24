# ECHO Data Ownership Audit

Date: 2026-08-24

## Summary

This audit compares repository evidence, migrations, route wiring, and live-integration code against the intended modular-monolith / service-schema design.

The current codebase is split between:

- a documented target architecture that expects service-owned schemas and backend-only Supabase access for application data,
- a live backend that still uses unqualified Supabase table names in most services,
- a service-schema migration set that defines the target ownership model,
- and a compatibility commit that partially moved calls back to unqualified names so the live app continues to work.

The main unresolved question is not whether service schemas exist in migration history. They do. The open question is whether the live Supabase project currently exposes them, whether the backend client is using the right schema-selection form, and whether all modules have been fully cut over from legacy `public.*` objects.

## Repository Baseline

### Current backend folder tree

```
backend/
  src/
    app.ts
    server.ts
    config/
    features/
      health/
      onboarding/
      experience/
      journals/
      settings/
      verification/
    infrastructure/
      ai/
      analysis/
      encryption/
      supabase/
    routes/
    shared/
  tests/
    e2e/
    infrastructure/
    security/
```

### Express request-wiring map

- `backend/src/server.ts` creates the Supabase admin client, encryption service, verification verifier, and feature services, then injects them into `createApp()`.
- `backend/src/app.ts` mounts `/api/v1` and wires global middleware: Helmet, CORS, no-store headers, request ID, request logging, JSON parsing, rate limiting, 404, and error handling.
- `backend/src/routes/v1.routes.ts` composes feature routers for health, journals, settings, experience, verification, and onboarding.
- `backend/src/features/*/*.routes.ts` defines the feature-level endpoints and auth gates.

### Feature-to-route map

| Feature | Routes |
|---|---|
| Health | `GET /health`, `GET /health/ready` |
| Onboarding | `GET /onboarding/status`, `POST /onboarding/consent`, `POST /onboarding/profile`, `POST /onboarding/setup`, `POST /onboarding/complete` |
| Journals | `GET /journals`, `POST /journals`, `GET /journals/draft`, `PUT /journals/draft`, `DELETE /journals/draft`, `GET /journals/:journalId`, `PATCH /journals/:journalId`, `DELETE /journals/:journalId`, `POST /journals/:journalId/analyze`, `GET /journals/:journalId/analyses` |
| Settings | `GET /settings`, `PATCH /settings/profile`, `PATCH /settings/privacy`, `PATCH /settings/notifications`, `POST /settings/trusted-contacts`, `PATCH /settings/trusted-contacts/:contactId`, `DELETE /settings/trusted-contacts/:contactId`, `POST /settings/data-exports`, `POST /settings/account-deletion`, `PATCH /settings/account-deletion/:requestId/cancel` |
| Experience | `GET /dashboard`, `GET /support-resources`, `GET /buddy/session`, `POST /buddy/messages`, `GET /buddy/history`, `GET /insights/emotions`, `POST /grounding/sessions` |
| Verification | `GET /verification`, `PUT /verification/application`, `PUT /verification/application/guardian`, `PUT /verification/documents/:documentType`, `POST /verification/submit`, `GET /admin/verifications`, `GET /admin/verifications/:verificationId`, `POST /admin/verifications/:verificationId/claim`, `POST /admin/verifications/:verificationId/decision` |

## Supabase Client Evidence

### Installed client versions

- Backend `@supabase/supabase-js`: `^2.57.4`
- Frontend `@supabase/supabase-js`: `^2.110.8`
- Frontend `@supabase/ssr`: `^0.12.3`

### Schema-selection rule

The audit treats only these as proper custom-schema selection:

- `database.schema("user_service").from("user_consents")`
- `database.schema("journal_service").from("journals")`
- module-specific clients initialized with the correct default schema

The audit treats `database.from("user_service.user_consents")` as incorrect dotted-table syntax, not as valid explicit schema selection.

## Complete Schema Inventory

### Application schemas from migration evidence

| Schema | Ownership evidence |
|---|---|
| `public` | Legacy and compatibility surface from early migrations; still holds many currently active tables in the repository history |
| `private` | Internal helper schema used by migration functions |
| `user_service` | Target schema for profile, consent, notification preference, privacy preference, trusted contact, export, and deletion data |
| `journal_service` | Target schema for journals, drafts, and journal analyses |
| `buddy_service` | Target schema for buddy conversations, messages, and feedback |
| `grounding_service` | Target schema for grounding and breathing session state |
| `insights_service` | Target schema for mood and insight read models |
| `notification_service` | Target schema for notifications and notification logs |
| `verification_service` | Target schema for verification application, documents, reviews, and admins |
| `ai_analysis` | Target schema for model versions, analysis requests/results, facial analysis, risk snapshots, safety events, prompt templates, and analysis audit logs |

### Shared / infrastructure schemas

| Schema | Notes |
|---|---|
| `auth` | Supabase-managed authentication schema; must not be modified as an ordinary domain schema |
| `storage` | Supabase-managed object storage schema/bucket layer |
| `graphql_public` | Supabase-managed exposure schema |
| `extensions` | Postgres extension schema |

## Query Classification

### Classification rules used in this audit

- Proper explicit schema selection: `schema("x").from("table")` or a module-specific client whose default schema is documented and proven.
- Default/public access: `from("table")` without schema selection.
- Incorrect dotted table syntax: `from("schema.table")`.
- Cross-module access: one module reads or writes another module’s owned data without a documented boundary.
- Shared infrastructure: `auth`, `storage`, or other managed/infrastructure schemas and read-only support data.
- Unresolved: the repository evidence is insufficient to determine the effective live schema or write target.

### Query audit totals

Observed application call sites reviewed in backend services and live integration code:

| Classification | Count | Notes |
|---|---:|---|
| Proper explicit schema selection | 1 | `user_service.user_consents` appears in the code, but as incorrect dotted syntax, so it is not counted here |
| Default/public access | 53 | Majority of backend service calls use unqualified table names |
| Incorrect dotted table syntax | 1 | `database.from("user_service.user_consents")` in onboarding |
| Cross-module access | 4 | Experience/dashboard and journal analysis flows read other module-owned data for orchestration |
| Shared infrastructure | 3 | Supabase Auth and Storage usage, plus support-resource read access where applicable |
| Unresolved | 2 | Live schema exposure and module-specific schema routing in the deployed project are not proven by repo evidence alone |

## Current Public-Table Dependencies

### Active public-schema dependencies in code or migration history

| Object | Current role in repository evidence |
|---|---|
| `public.profiles` | Legacy compatibility target from the older schema model; still referenced by some code paths and older migrations |
| `public.user_consents` | Legacy / pre-cutover consent table |
| `public.journals` | Legacy journal table |
| `public.journal_analyses` | Legacy analysis table used by current backend journal service |
| `public.mood_entries` | Legacy insight table |
| `public.trusted_contacts` | Legacy settings table |
| `public.notification_preferences` | Legacy settings table |
| `public.notifications` | Legacy notification table |
| `public.audit_events` | Shared server-only event log |
| `public.model_versions` | Legacy AI model registry |
| `public.analysis_windows`, `public.analysis_feedback`, `public.safety_events`, `public.support_resources`, `public.safety_event_resources`, `public.buddy_conversations`, `public.buddy_messages`, `public.data_export_requests`, `public.account_deletion_requests` | Legacy operational/shared tables from the earlier public-schema phase |

### Service-schema tables that now exist in migration history

- `user_service.profiles`
- `user_service.user_consents`
- `user_service.notification_preferences`
- `user_service.privacy_preferences`
- `user_service.trusted_contacts`
- `user_service.data_export_requests`
- `user_service.account_deletion_requests`
- `journal_service.journals`
- `journal_service.journal_drafts`
- `journal_service.journal_analyses`
- `buddy_service.buddy_conversations`
- `buddy_service.buddy_messages`
- `buddy_service.buddy_feedback`
- `grounding_service.grounding_sessions`
- `grounding_service.breathing_sessions`
- `insights_service.mood_entries`
- `notification_service.notifications`
- `notification_service.notification_logs`
- `verification_service.verification_admins`
- `verification_service.identity_verifications`
- `verification_service.verification_documents`
- `verification_service.verification_reviews`
- `ai_analysis.model_versions`
- `ai_analysis.analysis_requests`
- `ai_analysis.analysis_results`
- `ai_analysis.facial_analysis_results`
- `ai_analysis.risk_signal_snapshots`
- `ai_analysis.safety_events`
- `ai_analysis.prompt_templates`
- `ai_analysis.analysis_audit_log`

## Service-Schema Accessibility Findings

### Local exposure

The checked-in `supabase/config.toml` documents local API exposure as `public` and `graphql_public` only.

That proves only the local CLI configuration.

### Live exposure

The repository does not prove the live Supabase project configuration from Studio or from staging/production API exposure settings. Those remain unresolved until inspected directly in the deployed project or through read-only catalog queries against the live database.

### Why the app currently works through `public.*`

- The older migrations created many tables in `public`.
- The current backend still points many service methods at unqualified table names, which resolve to the default schema of the active Supabase client.
- The live integration test uses the service-role client against the same active Supabase project and confirms that the current default-schema surface still responds.
- The compatibility commit `1a8478e` explicitly rewired service calls from schema-qualified names back to unqualified table names, which preserves behavior only if the default schema still contains the expected tables.

### Why service-schema tables may remain empty

- The live project may still be receiving writes to `public.*` while the new service schemas are present but not yet targeted by the active code path.
- Some code still uses incorrect dotted syntax or legacy table names, which may not map to the intended schema at all.
- Schema exposure, grants, RLS, or search-path differences between local CLI, backend runtime, and live Studio may be preventing the intended service-schema target from being used.

## Cross-Module Reads and Writes

### Current cross-module dependencies in code

| Module | Reads from | Writes to | Notes |
|---|---|---|---|
| Experience | Journals, profiles, notification preferences, buddy tables, support resources, audit events | Buddy conversations/messages, notifications, audit events, grounding history | Orchestration-heavy module that spans several domains |
| Journals | User consents, notifications, audit events | Journal analyses, notifications, audit events | Analysis flow straddles user, journal, notification, and AI concerns |
| Verification | Notifications, audit events | Verification rows, documents, reviews, notifications, audit events | Admin workflow spans user access and notification emission |
| Settings | Profiles, notification preferences, privacy preferences, trusted contacts, export/deletion requests | Same tables | User module, but current code mixes legacy and target semantics |
| Onboarding | Profiles, consents, notification preferences, privacy preferences | Same tables | Currently contains the only explicit schema-qualified dotted call, but in incorrect form |

## Current-Versus-Intended Ownership Matrix

| Domain | Intended owner schema | Current repository evidence | Status |
|---|---|---|---|
| Identity/profile/settings | `user_service` | Mix of legacy `public.*` history, current unqualified calls, and one incorrect dotted consent call | In transition |
| Journals | `journal_service` | Unqualified backend calls to legacy/current journal tables; analysis flow writes notifications and audit events | In transition |
| Buddy | `buddy_service` | Unqualified backend calls; encrypted message content stored through experience orchestration | In transition |
| Verification | `verification_service` | Mostly unqualified calls to verification tables; admin workflow fully in backend | In transition |
| Notifications | `notification_service` | Unqualified backend writes; some notification state is still surfaced through settings/dashboard orchestration | In transition |
| Insights | `insights_service` | Current evidence is mostly derived in code, not persisted as an explicit schema-backed read model | Not yet fully separated |
| AI analysis | `ai_analysis` | Schema exists in migration history, but backend code currently still stores journal analyses in journal tables and uses a mock analysis provider | Not yet aligned |
| Support resources | Shared infrastructure / public read model | Read-only public support data | Shared |
| Audit log | Shared server-only infrastructure | `audit_events` remains server-only and shared across modules | Shared infrastructure |

## Environment Comparison

| Environment | Evidence available | Exposure conclusion |
|---|---|---|
| Local Supabase CLI | `supabase/config.toml` and migrations | `public` and `graphql_public` are documented API exposures locally |
| Backend runtime | `backend/src/config/environment.ts`, server client, admin client | Backend uses a service-role Supabase client and can access whatever the live project exposes to that key |
| Frontend runtime | `frontend/src/infrastructure/supabase/*` and env examples | Browser uses public auth config only and should route application data through HTTP |
| Staging | Not proven by repo evidence | Unknown |
| Production | Not proven by repo evidence | Unknown |
| Supabase Studio live project | Not proven by repo evidence | Unknown |

## Current Ownership Findings by Module

### User module

- Files: `backend/src/features/onboarding/`, `backend/src/features/settings/`
- Intended tables: `user_service.profiles`, `user_service.user_consents`, `user_service.notification_preferences`, `user_service.privacy_preferences`, `user_service.trusted_contacts`, `user_service.data_export_requests`, `user_service.account_deletion_requests`
- Current issues:
  - `database.from("user_service.user_consents")` is incorrect dotted syntax.
  - `profiles` updates and reads are still using default-schema selection.
  - `settings` still uses current unqualified table names for all user data.

### Journal module

- Files: `backend/src/features/journals/`
- Intended tables: `journal_service.journals`, `journal_service.journal_drafts`, `journal_service.journal_analyses`
- Current issues:
  - Reads/writes remain unqualified.
  - Journal analysis currently writes through the journal service instead of an explicit `ai_analysis` boundary.

### Buddy module

- Files: `backend/src/features/experience/`
- Intended tables: `buddy_service.buddy_conversations`, `buddy_service.buddy_messages`, `buddy_service.buddy_feedback`
- Current issues:
  - Buddy persistence is orchestrated by `experience`, not isolated into its own internal domain module.
  - The code uses encryption helpers from infrastructure, but the domain persistence is still coupled to the experience service.

### Verification module

- Files: `backend/src/features/verification/`
- Intended tables: `verification_service.identity_verifications`, `verification_service.verification_documents`, `verification_service.verification_reviews`, `verification_service.verification_admins`
- Current issues:
  - Mostly unqualified current access.
  - Admin and AI-access decisions are still mixed into verification orchestration.

### Notification module

- Files: current service calls from `journals`, `verification`, `settings`, `experience`
- Intended tables: `notification_service.notifications`, `notification_service.notification_logs`
- Current issues:
  - Notifications are written from multiple modules.
  - The codebase lacks an explicit dedicated backend module for notification lifecycle.

### AI analysis module

- Files: `backend/src/infrastructure/analysis/`, `backend/src/infrastructure/ai/`, `backend/src/features/journals/`, `backend/src/features/experience/`
- Intended tables: `ai_analysis.model_versions`, `ai_analysis.analysis_requests`, `ai_analysis.analysis_results`, `ai_analysis.facial_analysis_results`, `ai_analysis.risk_signal_snapshots`, `ai_analysis.safety_events`, `ai_analysis.prompt_templates`, `ai_analysis.analysis_audit_log`
- Current issues:
  - The schema exists in migration history, but the backend does not yet persist to it.
  - Journal analysis currently writes to `journal_analyses` instead.
  - Experience owns some AI-like orchestration and Buddy behavior that should be refactored behind clearer internal boundaries.

## Evidence Required Before Any Redirect

Before redirecting any read or write from legacy/default schema access to a service schema, the repository needs:

- live read-only confirmation that the target schema exists in the deployed project,
- live read-only confirmation that the target schema is exposed to the relevant API role,
- live read-only confirmation that the target tables exist and are populated or intentionally empty,
- RLS/grant evidence for the deployed project,
- a code path that uses either explicit `schema("x").from("table")` or a module-specific client with a documented default schema,
- and a per-module cutover plan that proves reads and writes still return database-confirmed rows after refresh and restart.

## Recent Compatibility Commit

Commit `1a8478e` reverted several service calls from schema-qualified names back to unqualified names:

- `experience.service.ts`
- `journals.service.ts`
- `onboarding.service.ts`
- `settings.service.ts`
- `verification.service.ts`

This compatibility commit should remain until each domain has a proven target-schema cutover, because it is the only evidence in this repo that the live app was kept functioning while the deployment boundary was still unresolved.

## Gate 1.5 Live Verification Addendum

### Project and migration alignment

- Backend and live integration target the same masked Supabase project ref: `wfoq...supabase.co`
- `supabase migration list` confirmed local and remote migration histories match through `20260824030000`
- `20260824030000_ai_analysis_schema.sql` is present remotely

### Live Data API exposure

Read-only REST probes against the live Supabase URL returned:

- `public.profiles` -> `206 Partial Content`
- `user_service.profiles` -> `406 Not Acceptable`, body code `PGRST106`, message `Invalid schema: user_service`
- `ai_analysis.analysis_requests` -> `406 Not Acceptable`, body code `PGRST106`, message `Invalid schema: ai_analysis`

Conclusion:

- `public` is exposed
- `graphql_public` is exposed
- `user_service` is not exposed
- `ai_analysis` is not exposed

### Readiness conclusion

- The live app still works through legacy/default-schema access because the backend uses unqualified `from(...)` calls and the live API still exposes `public`.
- Service-schema tables may remain empty because the live Data API currently blocks them entirely.
- The first controlled cutover slice should be the user module, but only after live `user_service` exposure and grants are proven.

## New project verification addendum

- Linked project ref: `lruciislmmqvcwweqjop`
- Old project ref `wfoqjzgkrosdooetohhh` was not targeted during these steps
- `supabase db push --linked --project-ref lruciislmmqvcwweqjop --include-seed --yes` applied the repository migration chain and seed to the new project
- Postgres inspection on the new project shows the full app schema set exists in the database:
  - `user_service`
  - `journal_service`
  - `buddy_service`
  - `verification_service`
  - `notification_service`
  - `grounding_service`
  - `insights_service`
  - `ai_analysis`
- REST exposure still lags schema presence:
  - `public` responds successfully
  - `user_service` returns `406`
  - `ai_analysis` returns `406`
- Generated type output now exists at `backend/src/infrastructure/supabase/database.types.ts`
