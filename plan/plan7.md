# Plan 7: Full QA and Security Verification for Echo

## Summary
Validate that Echo’s full product surface works end to end and that the current security controls hold under normal and failure conditions. The plan covers public pages, auth and onboarding, protected product flows, backend APIs, database policy enforcement, and security regression checks. The output should be a prioritized QA/security report with reproducible evidence, clear severity, and fix recommendations.

## Coverage
- Public routes: `/`, `/about`, `/privacy-policy`, `/terms`, `/support/find-help`, `/crisis`, `/crisis-help`
- Auth and onboarding: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/onboarding/consent`, `/onboarding/profile`, `/onboarding/setup`
- Protected product flows: `/dashboard`, `/journal`, `/journal/new`, `/journal/[id]`, `/buddy`, `/buddy/history`, `/insights/emotion`, `/insights/facial`, `/insights/risk`, `/tools/grounding`
- Settings and account flows: `/settings`, `/settings/profile`, `/settings/security`, `/settings/privacy`, `/settings/notifications`, `/settings/export`, `/settings/trusted-contacts`, `/settings/verification`
- Admin and verification surface: `/admin/verifications`
- Backend endpoints and health: `/health`, `/api/v1/journal`, `/api/v1/buddy/conversations`, `/api/v1/grounding/sessions`, `/api/v1/settings/profile`, `/api/v1/onboarding`, `/api/v1/verification`
- Database and policy surface: Supabase migrations, RLS policies, immutable consent history, owner isolation, and sensitive-data handling

## Validation Sequence
- Establish a baseline with the repo’s existing checks: typecheck, lint, unit tests, build, and any available database tests.
- Run a full frontend walkthrough for each route group and confirm:
  - Routing works without console/runtime errors.
  - Auth gating behaves correctly for signed-out, signed-in, and partially onboarded users.
  - Forms, dialogs, autosave, loading states, empty states, and error states behave correctly.
  - Responsive layout, keyboard navigation, and accessibility behavior are stable.
- Run backend API verification for happy paths and failure paths:
  - Validate request schema enforcement and response shapes.
  - Confirm auth-required routes reject unauthenticated or malformed tokens.
  - Confirm rate limiting and error handling on protected endpoints.
  - Confirm backend does not leak secrets, stack traces, or internal tokens in responses.
- Run security-focused checks:
  - Unauthenticated access to protected UI and API routes is blocked.
  - JWT/session verification fails closed.
  - RLS policies prevent cross-user reads and writes.
  - Sensitive fields remain redacted in logs and error output.
  - Export, deletion, verification, and consent flows preserve the intended privacy rules.
- Review tests tied to the security contract:
  - Frontend route/component tests.
  - Backend route and service tests.
  - Supabase database policy tests.
  - Live integration tests only if the local environment is available and configured.

## Test Plan
- Frontend:
  - `npm run typecheck -w frontend`
  - `npm run test -w frontend`
  - `npm run build -w frontend`
  - Manual/browser validation for each route group, including mobile and desktop viewports
- Backend:
  - `npm run typecheck -w backend`
  - `npm run test -w backend`
  - `npm run build -w backend`
- Database/security:
  - Run the Supabase SQL policy tests in `supabase/tests/database/`
  - Verify the latest migrations apply cleanly and preserve existing behavior
  - If available, run the live integration path that exercises authenticated isolation and consent history
- Acceptance criteria:
  - No uncaught runtime errors on core flows
  - No broken routes or auth redirects
  - No cross-user data exposure
  - No critical or high-severity security findings left open
  - Any medium/low findings are documented with clear reproduction steps and owners

## Assumptions
- This is a verification pass, not a feature rewrite.
- Existing routes, APIs, and schema are the source of truth.
- Any failures found during QA/security review will be reported first, then fixed in a follow-up change set.
- If a local service or credential is unavailable, that blocker will be called out explicitly rather than guessed around.
- The final deliverable is a concise QA/security findings report with pass/fail status per surface, plus remediation recommendations where needed.
