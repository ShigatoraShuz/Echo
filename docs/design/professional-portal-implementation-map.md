# Professional Portal Implementation Map

**Status:** Working implementation note for FE-002 / FE-003  
**Target branch:** `feat/professional-portal-design`  
**Baseline reviewed:** `ready-for-qa-and-implementation` at `8947eddc4c52228a859b4cfced2050407b692401`

## Confirmed existing frontend seams

- `frontend/src/shared/components/layout/echo-shells.tsx` exports `AppShell`, `AppSidebar`, `AuthLinkCard`, `AuthShell`, `OnboardingShell`, and `PublicShell`.
- `AppShell` currently owns the responsive sidebar/mobile menu and renders `AppSidebar`.
- `AppSidebar` has a hard-coded User Side navigation list: Dashboard, Journal, Buddy, Insights, Grounding, Find help, and Settings. It also includes Crisis Support and Privacy links.
- The shared layout barrel is `frontend/src/shared/components/layout/index.ts`.
- `EchoCard` and `PageHeader` are exported from that same barrel. `EchoCard` supports title, description, action, children, className, and compact mode; `PageHeader` supports label, title, description, and action.
- Existing shell source already uses Echo-specific tokens and patterns, including `--font-echo-display`, `text-primary`, `text-foreground`, `text-muted-foreground`, and existing Tailwind utilities. Reuse these instead of introducing new global styling.

## Critical integration finding

**Do not mount the Professional Side inside the current `AppShell` unchanged.** Its navigation is hard-coded to User Side routes, so doing so would make the professional workspace show incorrect navigation and blur the two experiences.

For FE-003, refactor only the shell's navigation configuration seam while preserving the current default User Side behavior exactly. A suitable implementation should allow an explicit navigation configuration (and optionally a workspace label) to be passed to the shell/sidebar, with the current User Side links remaining the default. Professional routes must pass a separate Professional Side navigation definition. Keep the Crisis Support and Privacy destinations in the existing User Side behavior unless product routing explicitly requires otherwise.

This is a scoped composition change, not a theme redesign: preserve the existing shell layout, colors, typography, radii, spacing, focus behavior, responsive menu mechanics, and shared components.

## Professional navigation proposal

Only expose destinations already supported by the current application/API; confirm actual route paths and page ownership during implementation before wiring links.

1. **Overview** — professional landing page; show counts only if backed by real authorized API data.
2. **Requests** — eligible requests and their existing review/claim actions.
3. **My Cases** — cases visible to the current professional under existing organization, assignment, role/credential, and sharing rules.
4. **Settings** — only existing professional profile/settings routes and capabilities.

Case detail is reached from Requests or My Cases rather than being a top-level navigation item. Appointments, notes, referrals, and verification should be surfaced only where an existing route and API contract support them.

## Screen composition rules

- Use `PageHeader` for consistent page hierarchy and `EchoCard` for grouped content; use existing buttons, badges, tables, forms, icons, and status treatments already in the app.
- Requests and cases must provide loading, empty, error/retry, access-restricted, conflict, and revoked-sharing states where applicable.
- Do not show a client journal as a general feed. Render only selected shared items authorized by the backend; distinguish those from professional-authored notes.
- Never treat hidden navigation or disabled controls as authorization. Preserve backend enforcement for membership, role/credential validity, assignment, consent/sharing, and organization boundaries.
- Use real API data and real response states. Any fixture/demo data must be unmistakably labelled and must not look like production client data.
- On narrow screens, follow the existing responsive shell patterns and retain readable status text and reachable actions; do not rely on color alone.

## FE-003 implementation and verification checklist

- [ ] Add explicit, typed navigation configuration without changing the current User Side defaults.
- [ ] Add the Professional Side route group/layout only after confirming actual existing route paths and auth guards.
- [ ] Compose pages from existing Echo shared primitives; do not add a new theme or global CSS overrides.
- [ ] Preserve existing User Side links and shell behavior.
- [ ] Verify desktop, tablet, and mobile navigation, keyboard focus, active-link semantics, and accessible labels.
- [ ] Verify professional API loading/empty/error/restricted states and no cross-organization or unshared-content leakage.
- [ ] Run frontend typecheck, lint, tests, production build, and the existing User Side regression suite.
- [ ] Record screenshots or test evidence for the review; do not mark FE-002 approved until the screen-level design and regression evidence are reviewed.

## Scope guardrails

This note does not authorize backend schema/API changes, a new visual identity, User Side redesign, or unsupported features. It documents a safe path to compose the existing Echo UI into a distinct professional workflow.
