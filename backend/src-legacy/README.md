# Quarantined legacy backend stack

Retired 2026-08-15 as part of ECHO-002 (backlog §3.2 defect 1).

These files were the pre-existing duplicate Express stack that:

- Broke compilation (`src/index.ts` log syntax, `journal.routes.ts` search syntax).
- Used a decode-and-trust JWT verifier (`shared/middleware/auth.ts`) instead of verified
  bearer tokens (`shared/middleware/auth.middleware.ts`).
- Referenced packages that are not installed (`morgan`, `@jest/globals`).
- Duplicated runtime routes already served by `src/routes/v1.routes.ts`
  (journals, settings, experience, verification, health).

The canonical composition root is:

- Entry: `src/server.ts`
- App: `src/app.ts`
- Router: `src/routes/v1.routes.ts`

Rules:

- Nothing under `src/` may import anything under `src-legacy/`.
- `src-legacy/` is excluded from `tsconfig.json`, ESLint, and Vitest.
- Do not resurrect these files; port any still-needed behavior through the
  active layered stack (route -> controller -> service -> repository).

Files quarantined:

- index.ts, routes/v1.ts
- features/buddy/conversations.routes.ts, messages.routes.ts
- features/insights/insights.routes.ts, camera-mood.routes.ts
- features/grounding/grounding.routes.ts
- features/journal/journal.routes.ts
- features/onboarding/onboarding.routes.ts
- features/settings/profile-settings.routes.ts, notifications.routes.ts, data-management.routes.ts
- shared/middleware/auth.ts, errorHandler.ts
- shared/errors/AppError.ts
- tests/integration/* (buddy, grounding, journal, settings)