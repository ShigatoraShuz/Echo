# Echo Professional Portal — Design Specification (FE-002)

**Status:** Draft for review  
**Sprint:** 0 — Professional Portal  
**Scope:** Design the Professional Side without replacing or regressing the existing User Side.

## Non-negotiable design constraint

**The existing Echo theme is the source of truth.** Do not introduce or substitute a new palette, typography, spacing scale, radius scale, shadows, or independent visual identity. Reuse the current theme tokens, global styles, Tailwind configuration, shared layouts, and existing UI components. The earlier generated concept image is not an approved visual reference and its styling must not be copied unless it demonstrably matches the repository.

## Product structure

Echo has two distinct experiences on one platform:

- **User Side:** existing personal mental-health experience. Preserve its routes, navigation, appearance, features, and workflows.
- **Professional Side:** dedicated workspace for authorized professionals, with professional-specific navigation and workflows.

Shared infrastructure and design components do not imply shared permissions. UI visibility is never a substitute for backend authorization.

## Design principles

1. Preserve existing Echo colors, typography, spacing, radius, component behavior, and interaction patterns.
2. Prefer reuse over duplication: inspect shared shadcn/Radix/Tailwind components, Lucide icons, and Echo layouts before adding components.
3. Keep professional navigation distinct enough to orient professionals while remaining visually consistent with Echo.
4. Make consent and sharing boundaries understandable; visually distinguish user-shared journal content from professional-authored notes.
5. Treat accessibility and responsive behavior as requirements: keyboard navigation, visible focus, semantic labels, readable contrast, touch-friendly controls, and narrow-screen layouts.
6. Include appropriate loading, empty, error, access-denied, conflict, and revoked-sharing states. Do not rely on color alone for status.
7. Use only capabilities supported by the current application and API; do not invent dashboard metrics or integrations.

## Screen inventory

### 1. Professional sign-in and access
Use the existing authentication foundations and theme. Design the professional entry point, MFA/reauthentication prompts where required, access/eligibility states, and safe next steps when access is blocked. Do not create a parallel authentication system or alter the User Side login flow.

### 2. Professional overview
Provide clear orientation and navigation to supported work areas. Show summary counts or appointment/activity previews only when reliable existing API data supports them. Include an empty state for professionals with no current cases or appointments.

### 3. Requests queue
Present only the minimum safe information needed to review eligible requests. Distinguish statuses using text and existing theme tokens. Design claim confirmation and success/error/conflict feedback. Do not expose shared journal contents unless the existing contract explicitly allows it.

### 4. My Cases
Show cases permitted for the current professional and organization. Include loading, empty, and retry states. Filters and search must not imply broader permissions.

### 5. Case details
Recommended hierarchy:
- Case status and assignment context.
- Client-shared summary and selected shared items, only while sharing is active and the viewer is authorized.
- Supported appointment details and actions.
- Professional-authored notes, clearly distinct from user journals.
- Supported referrals and case actions.
- Sharing/access status and a safe explanation when shared content is unavailable.

Never display all user journals by default. Respect ownership, explicit selection, active sharing, assignment, organization membership, role, credential validity, and server authorization.

### 6. Appointments, notes, referrals, profile/settings
Design only workflows and actions confirmed to exist in the current app/API. Show authorship and timestamps for notes/referrals. Do not assume calendar integration, chat, billing, export, or unsupported editing/retention actions.

## Layout and responsive behavior

- **Desktop:** reuse existing Echo shell patterns; use a consistent page heading, contextual actions, and professional navigation.
- **Tablet/mobile:** adapt the existing layout/navigation patterns rather than creating a new visual system; ensure actions remain reachable and content follows a logical reading order.
- Wide tables should become readable responsive rows/cards or use controlled horizontal overflow without hiding important statuses/actions.
- Avoid hover-only interactions and respect reduced-motion preferences.

## Privacy and authorization boundaries

The UI must reflect, but never replace, backend-enforced controls:
- Authentication, MFA/reauthentication, organization membership, role, credential validity, assignment, and eligibility checks apply as defined by each operation.
- Professionals see only cases allowed by their organization and assignment.
- Shared data is limited to selected information and active consent/sharing.
- Revoked sharing must stop access according to the backend contract.
- Professional notes/referrals remain distinct from user-authored journals.
- Restricted states must not leak the existence of unrelated users' cases or other organizations' records.

## FE-002 acceptance criteria

- [ ] Existing User Side appearance, routes, navigation, and workflows are explicitly protected from regression.
- [ ] Existing professional routes and components are inventoried; reuse/refinement decisions are recorded.
- [ ] Professional navigation and screen hierarchy are documented.
- [ ] Sign-in/access, overview, Requests, My Cases, and case details are covered; other screens are included only where supported.
- [ ] Desktop, tablet, and mobile behavior is specified.
- [ ] Loading, empty, error, access-restricted, conflict, and revoked-sharing states are specified where relevant.
- [ ] Shared user content and professional-authored content are visually distinguishable.
- [ ] Existing Echo theme tokens, typography, and shared components are used; no new theme is introduced.
- [ ] Placeholder data is clearly marked and never represented as production data.
- [ ] Design review/approval is recorded before FE-002 is marked Done.

## Handoff to FE-003

After FE-002 design review/approval, FE-003 can implement or refine the responsive professional shell and integrate it with existing routes/components. Verify User Side regression behavior and responsive/accessibility states. Do not change backend schema or authorization as part of a design-only task.

**Backlog status:** Keep FE-002 To Do until the screen-level design is reviewed and approved.
