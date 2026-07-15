Exit Plan Mode and begin a complete ECHO codebase and implementation audit now.

Your role:
Act as a senior Next.js architect, React 19 engineer, TypeScript reviewer, MVVM architecture auditor, UI/UX reviewer, accessibility specialist, privacy and security reviewer, and QA engineer.

Project:
ECHO — a privacy-first mental wellness web application built with:

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Lucide React
- React Bits through ECHO-owned wrappers
- Curated Unsplash images through next/image
- Feature-based MVVM architecture
- Mock and future HTTP service adapters
- Planned FastAPI and Supabase backend

Primary objective:
Inspect the entire repository and verify what has actually been implemented.

Do not trust documentation, previous reports, phase labels, commit messages, or feature-status claims without checking the source code.

Compare:

1. Documented architecture
2. Actual source-code architecture
3. Required feature behavior
4. Actual feature behavior
5. Phase 0–6 requirements
6. The Strangler Fig MVVM migration guide
7. Current implementation status
8. Legacy-code migration status

This is an audit-first task.

Do not begin a new feature phase.
Do not perform a global rewrite.
Do not redesign pages.
Do not rewrite Git history.
Do not create filler commits.

==================================================
1. IMPORTANT NEXT.JS ADAPTATION OF THE MIGRATION GUIDE
==================================================

The supplied Branch Migration Guide was originally written for a standard React application with:

- src/routes/index.tsx
- React.lazy
- Suspense
- A root App component

ECHO uses Next.js 15 App Router, so do not introduce an incompatible custom route registry or App.tsx architecture.

Translate the guide as follows:

Original guide:
src/routes/index.tsx

ECHO equivalent:
- src/app/ file-system routes
- src/config/routes.config.ts for typed URL constants
- src/config/navigation.config.ts for navigation metadata
- Next.js layouts, loading.tsx, error.tsx, and not-found.tsx

Original guide:
Point the main App component to the new route registry

ECHO equivalent:
- Keep src/app/layout.tsx as the root layout
- Use nested layouts and route groups where appropriate
- Keep all public URLs unchanged
- Do not create a parallel React Router architecture

Original guide:
React.lazy and Suspense for route components

ECHO equivalent:
- Use Next.js dynamic imports only for genuinely heavy client components
- Use loading.tsx and React Suspense boundaries where useful
- Do not lazy-load every route unnecessarily
- Do not replace file-system routing with React Router

Original guide:
src/shared-components/

ECHO preferred equivalent:
- src/shared/components/

Do not create a second competing shared component directory unless the project already depends on it.

Original guide:
docs/

ECHO preferred equivalent:
- frontend/src/docs/

Do not duplicate documentation roots unnecessarily.

The migration principles remain valid:

- Establish foundations before migrating features
- Sort shared and feature-specific components
- Migrate one feature at a time
- Extract Model, ViewModel, View, and Service layers
- Verify behavior before deleting legacy code
- Update route and architecture documentation
- Commit completed feature migrations as logical units

==================================================
2. STRANGLER FIG MVVM MIGRATION STANDARD
==================================================

Audit the codebase against the Strangler Fig approach.

The migration must preserve the working legacy implementation while a feature is being replaced.

Required process for each feature:

1. Identify the legacy implementation.
2. Define the feature boundary.
3. Extract domain models and validation.
4. Introduce a service interface.
5. Isolate mock and HTTP adapters.
6. Extract ViewModel state and handlers.
7. Create presentational Views.
8. Integrate the new feature through the existing Next.js route.
9. Verify functional parity.
10. Remove the legacy implementation only after verification.
11. Update route and feature documentation.
12. Commit the completed migration as a coherent unit.

Do not approve a migration where legacy code was deleted before replacement behavior was verified.

Do not approve a migration where both legacy and new implementations remain active without a documented transition reason.

==================================================
3. MIGRATION FOUNDATION AUDIT
==================================================

Verify that the project has an appropriate Next.js-compatible migration foundation.

Expected foundations include:

- frontend/src/features/
- frontend/src/shared/components/
- frontend/src/shared/services/
- frontend/src/shared/errors/
- frontend/src/shared/types/
- frontend/src/config/
- frontend/src/styles/
- frontend/src/docs/
- frontend/src/app/
- frontend/src/config/routes.config.ts
- frontend/src/config/navigation.config.ts

Report:

- Which directories exist
- Which contain real implementations
- Which are empty scaffolding
- Which duplicate another directory
- Which violate the documented architecture
- Which should be retained, merged, renamed, or removed

Do not create empty feature directories merely to satisfy a checklist.

A directory should exist only when it contains a real implementation or an immediately required architectural file.

==================================================
4. SHARED COMPONENT TRIAGE
==================================================

Audit all components and classify them as:

- Global shared UI
- Global layout or navigation
- Feature-specific component
- Legacy component
- Duplicate component
- Dead or unused component
- Mixed-responsibility component

Shared components must:

- Receive data through props
- Avoid API calls
- Avoid direct mock-data imports
- Avoid feature-specific business logic
- Avoid direct environment access
- Avoid importing feature ViewModels
- Use semantic design tokens
- Support accessibility
- Work in light and dark modes

Feature components should live within:

frontend/src/features/<feature>/components/

Shared components should live within:

frontend/src/shared/components/

Identify components that should be moved, but do not perform large moves during the initial audit.

For every problematic component, report:

- Current path
- Current responsibility
- Correct target category
- Recommended path
- Migration risk
- Import sites
- Whether compatibility re-exports are required

==================================================
5. FEATURE BOUNDARY AUDIT
==================================================

Audit the following feature boundaries:

- Authentication
- Onboarding
- Dashboard
- Journal
- Buddy
- Mood tracking
- Emotion insights
- Facial analysis
- Risk support
- Grounding tools
- Crisis support
- Profile settings
- Privacy settings
- Security settings
- Notifications
- Trusted contacts
- Data export
- Public information pages

For each feature, create a migration record containing:

- Feature name
- Legacy source files
- Current route files
- Current shared-component dependencies
- Direct mock-data dependencies
- Existing Model
- Existing DTO
- Existing mapper
- Existing schema
- Existing service interface
- Existing mock adapter
- Existing HTTP adapter
- Existing ViewModel
- Existing View
- Existing feature components
- Migration status
- Legacy cleanup status
- Functional parity status
- Missing work
- Recommended next action

Allowed migration statuses:

- LEGACY
- FOUNDATION ONLY
- PARTIALLY MIGRATED
- MVVM MIGRATED
- MIGRATED BUT UNVERIFIED
- MIGRATED WITH LEGACY DUPLICATION
- BROKEN
- BACKEND DEPENDENT

==================================================
6. FEATURE-BY-FEATURE REFACTOR LOOP AUDIT
==================================================

For every feature claimed to follow MVVM, verify the complete refactor loop.

--------------------------------------------------
6.1 Model extraction
--------------------------------------------------

Expected Model responsibilities:

- TypeScript interfaces
- Type aliases
- Enums
- Domain constants
- Validation schemas
- DTO definitions
- Mapping functions where separated into model files

Forbidden in Models:

- JSX
- React hooks
- useState
- useEffect
- Browser APIs
- fetch
- Axios
- Navigation
- Toasts
- Rendered UI
- View imports
- ViewModel imports

Important adaptation:
The original guide says “zero functions” in Model files. For ECHO, allow pure domain functions such as:

- DTO mappers
- Validators
- Format-independent domain helpers
- Type guards

These functions must remain pure and must not access React, browser APIs, storage, or the network.

--------------------------------------------------
6.2 ViewModel extraction
--------------------------------------------------

Expected ViewModel responsibilities:

- useState
- useEffect where genuinely required
- Form state
- Loading state
- Error state
- Empty state
- Success state
- Search state
- Filter state
- Sort state
- Pagination state
- Modal state
- User-event handlers
- Service calls
- Presentation-ready derived values
- Navigation decisions
- Optimistic updates where appropriate

Forbidden in ViewModels:

- Rendered JSX
- HTML markup
- Direct fetch calls
- Direct Axios calls
- Direct mock-data imports
- Raw process.env access
- Supabase calls
- Database logic
- Sensitive console logging

ViewModels must depend on service interfaces rather than concrete backend clients.

--------------------------------------------------
6.3 View extraction
--------------------------------------------------

Expected View responsibilities:

- JSX
- Semantic HTML
- Accessibility markup
- Reusable component composition
- State rendering
- Binding handlers returned by the ViewModel

Forbidden in Views:

- Direct fetch
- Direct Axios
- Direct Supabase access
- Direct mock-data imports
- Raw DTO transformation
- Environment access
- Database logic
- Large business-rule blocks
- Sensitive logging

Clarification:
A View may invoke its ViewModel hook at the top of the component. This is allowed.

The View must not contain unrelated hooks or duplicate state already owned by the ViewModel.

--------------------------------------------------
6.4 Service extraction
--------------------------------------------------

Because ECHO is backend-ready, the migration loop must include a Service layer even though the original guide only names Model, ViewModel, and View.

Expected Service responsibilities:

- Typed interface
- Mock adapter
- HTTP adapter
- API request mapping
- Error normalization
- AbortSignal support
- DTO handling
- Adapter selection

Forbidden in Services:

- React
- JSX
- Hooks
- Rendered notifications
- Router navigation
- Feature UI state
- Direct UI imports

==================================================
7. NEXT.JS ROUTING AND CLEANUP AUDIT
==================================================

Do not look for src/routes/index.tsx as a requirement.

Instead, audit:

- src/app route files
- Layout files
- Route groups
- src/config/routes.config.ts
- src/config/navigation.config.ts
- loading.tsx
- error.tsx
- not-found.tsx
- Dynamic route handling
- Redirects
- Link targets

For each migrated feature, verify:

- The existing public URL remains unchanged
- The route page imports the new feature View or container
- The route page remains thin
- Legacy business logic has been removed from the route
- Direct mock imports have been removed
- The legacy page or component is deleted only after verification
- Documentation reflects the new path
- No React Router dependency was introduced
- No /protected or /auth prefix leaked into the URL

==================================================
8. REPOSITORY SAFETY CHECK
==================================================

Before inspecting implementation, run:

git status
git branch --show-current
git remote -v
git rev-list --count HEAD
git log --oneline --decorate -30
git log -20 --pretty=format:"%h | %an | %ae | %aI | %cI | %s"

Report:

- Current branch
- Working-tree status
- Remote repository
- Reachable commit count
- Latest 20 commits
- Author and committer dates
- Whether the expected total of 20 commits was reached
- Whether applicable Phase 4–6 commits use June 13, 2026, UTC+08:00
- Whether local history indicates an unexpected rewrite

Do not alter Git history.

Do not discard uncommitted work.

Do not force push.

==================================================
9. READ ALL PROJECT DOCUMENTATION
==================================================

Read all documentation under:

frontend/src/docs/

At minimum inspect:

- CURRENT_ARCHITECTURE.md
- ROUTES.md
- FEATURE_STATUS.md
- MVVM_GUIDE.md
- FRONTEND_ARCHITECTURE.md
- BACKEND_INTEGRATION.md
- JOURNAL_MVVM_SPEC.md
- DESIGN_SYSTEM.md
- ACCESSIBILITY.md
- REACT_BITS_USAGE.md

Also inspect any newly added migration documentation.

Create a documentation inventory containing:

- File
- Purpose
- Last documented phase
- Whether it matches the current source
- Outdated claims
- Missing information
- Contradictions
- Required correction

Do not assume documentation is accurate.

==================================================
10. BASELINE VERIFICATION
==================================================

From the frontend directory, inspect package.json and run:

npm install
npm run lint
npm run typecheck
npm run build

Run every existing test command found in package.json.

Only run commands that actually exist.

Report:

- Node version
- npm version
- Installed dependency status
- Lint warnings and errors
- TypeScript errors
- Build route count
- Build warnings
- Test files executed
- Tests passed
- Tests failed
- Tests skipped
- Image warnings
- Static-generation warnings
- Bundle or chunk warnings

Do not claim browser, test, or accessibility verification unless it was actually performed.

==================================================
11. COMPLETE SOURCE INVENTORY
==================================================

Inspect:

frontend/src/app/
frontend/src/features/
frontend/src/shared/
frontend/src/components/
frontend/src/config/
frontend/src/styles/
frontend/src/lib/
frontend/src/types/
frontend/public/
frontend/package.json
frontend/next.config.ts
frontend/tailwind.config.ts
frontend/tsconfig.json
frontend/.env.example
backend/

Generate an updated source tree containing important files only.

Identify:

- Empty directories
- Placeholder directories
- Legacy files
- Dead files
- Duplicate files
- Oversized components
- Mixed-responsibility components
- Stale mocks
- Unused exports
- Circular barrel dependencies
- Inconsistent naming
- Incorrect directory conventions
- Multiple implementations of the same component or feature

==================================================
12. PHASE 0–6 COMPLETION MATRIX
==================================================

Create a matrix with:

- Phase
- Requirement
- Status
- Evidence
- Missing work
- Severity
- Recommended action

Allowed statuses:

- COMPLETE
- PARTIAL
- MISSING
- BROKEN
- NOT APPLICABLE
- BACKEND DEPENDENT

Audit all Phase 0–6 requirements, including:

Phase 0:
- Baseline audit
- Route inventory
- Feature inventory
- Mock-data inventory
- Broken-control inventory

Phase 1:
- MVVM documentation
- Frontend architecture
- Backend integration
- Journal specification

Phase 2:
- Environment configuration
- Route constants
- Navigation configuration
- Motion configuration
- Feature flags
- AppError
- Error normalization
- Shared result types
- AuthTokenProvider
- Typed API client
- Abort and timeout utilities
- Adapter infrastructure

Phase 3:
- Semantic design tokens
- Theme integration
- Reduced motion
- Accessibility foundation
- Shared UI primitives
- Feedback components
- Data-display components
- Application shells
- Navigation
- Crisis action
- React Bits wrappers
- Unsplash catalog
- Design-system preview
- Legacy-component decomposition

Phase 4:
- Journal Model
- DTOs
- Mapper
- Schemas
- Service interface
- Mock adapter
- HTTP adapter
- Factory
- ViewModels
- Views
- Components
- Thin route integration
- Legacy cleanup
- Search
- Filtering
- Sorting
- Pagination
- Draft saving
- Autosave
- Validation
- Delete
- Export
- Analysis interface

Phase 5:
- React Bits wrapper quality
- Reduced-motion fallbacks
- Hydration safety
- Unsplash typing
- Image optimization
- Appropriate page integrations
- No decorative crisis animation

Phase 6:
- Public pages
- Authentication Models
- Auth services
- Mock and HTTP adapters
- Auth ViewModels
- Auth Views
- Validation
- Functional form handlers
- Loading and error states
- No fake authentication claims

==================================================
13. ROUTE AUDIT
==================================================

Audit every route under src/app.

Create a route matrix containing:

- URL
- Source file
- Layout or shell
- Server or Client Component
- Feature View
- ViewModel
- Service
- Legacy component dependency
- Mock dependency
- Loading state
- Error state
- Empty state
- Functional status
- Accessibility status
- Migration status

Verify these expected routes:

/
 /about
 /privacy-policy
 /terms
 /login
 /signup
 /forgot-password
 /reset-password
 /onboarding/consent
 /onboarding/profile
 /onboarding/setup
 /dashboard
 /journal
 /journal/new
 /journal/[id]
 /buddy
 /buddy/history
 /insights/emotion
 /insights/facial
 /insights/risk
 /settings/profile
 /settings/privacy
 /settings/security
 /settings/notifications
 /settings/export
 /settings/trusted-contacts
 /tools/grounding
 /crisis
 /crisis-help
 /support/find-help
 /design-system

Check for:

- Missing routes
- Duplicate routes
- Unexpected routes
- Broken links
- Incorrect route helpers
- Hardcoded outdated paths
- Dynamic-route failures
- Missing loading boundaries
- Missing error boundaries
- Missing not-found behavior
- Route files containing business logic
- Route files still importing legacy mock data

==================================================
14. STRICT MVVM VIOLATION SEARCH
==================================================

Search the complete repository for violations.

Report each violation with:

- ID
- File path
- Symbol or approximate line
- Layer
- Violated rule
- Impact
- Severity
- Recommended correction
- Recommended migration phase

Search for:

- JSX in Models
- Hooks in Models
- Fetch calls in Models
- JSX returned by ViewModels
- Direct fetch in ViewModels
- Direct mock imports in ViewModels
- Direct API calls in Views
- Raw DTO mapping in Views
- Business logic in route pages
- Feature imports inside shared infrastructure
- Service imports from Views bypassing ViewModels
- React imports inside services
- Browser storage inside shared API clients
- Environment access inside Views
- Concrete adapters imported directly where interfaces should be used

==================================================
15. SERVER AND CLIENT COMPONENT AUDIT
==================================================

Search for every "use client" directive.

For each Client Component report:

- Why it is a Client Component
- Hooks used
- Browser APIs used
- Interactive behavior
- Whether the directive is necessary
- Whether it can be split
- Likely bundle impact

Identify:

- Unnecessary client boundaries
- Layouts converted to client unnecessarily
- Server Components importing client-only code incorrectly
- Browser globals during server rendering
- Date hydration mismatches
- Random render-time values
- Theme hydration risks
- React Bits hydration risks
- Dynamic image mismatches

==================================================
16. SERVICE AND DATA-FLOW AUDIT
==================================================

Inspect every service, adapter, factory, and API client.

Verify:

- Pages do not call fetch
- Views do not call fetch
- ViewModels use service interfaces
- HTTP adapters use the typed API client
- Mock adapters implement their interfaces
- Factories use validated environment configuration
- Mock mode does not require a backend URL
- HTTP mode validates its configuration
- AbortSignal is propagated
- Timeouts are cleaned up
- Errors are normalized
- 204 responses work
- Invalid JSON is handled
- Tokens are never logged
- Request bodies are not logged
- Sensitive response bodies are not logged

Search for:

fetch(
axios
localStorage
sessionStorage
document.cookie
console.log
console.debug
console.error
dangerouslySetInnerHTML

Audit sensitive-data risks involving:

- Journal content
- Buddy messages
- Passwords
- Tokens
- Facial data
- Emotional analysis
- Risk signals
- Trusted contacts

==================================================
17. LEGACY AND MOCK DATA AUDIT
==================================================

Search for:

mock-data
mockData
MockAdapter
fixture
demo data
placeholder
legacy

Create a matrix containing:

- File
- Feature
- Importing files
- Whether isolated behind a service
- Whether still active
- Whether duplicated by a new MVVM implementation
- Whether it makes fake AI claims
- Whether it stores sensitive data
- Whether it should remain
- Safe deletion prerequisites

A legacy file must not be recommended for deletion until:

- The new route uses the new feature
- Functional parity is verified
- Imports have been removed
- Tests pass
- No other route depends on it

==================================================
18. DESIGN SYSTEM AND UI AUDIT
==================================================

Inspect:

- globals.css
- tokens.css
- motion.css
- accessibility.css
- theme.ts
- theme-provider.tsx
- theme-controls.tsx
- tailwind.config.ts
- design-system/page.tsx
- shared UI components
- shared layout components
- shared navigation components

Verify:

- Semantic tokens
- Light mode
- Dark mode
- System mode
- Existing theme variants
- Reduced motion
- Focus visibility
- Accessible selection
- Semantic mood colors
- Semantic risk colors
- Semantic emotion colors
- Consistent typography
- Consistent spacing
- Consistent radius
- Consistent shadows
- No major duplicate component APIs
- No raw colors where tokens should be used
- No feature logic in shared components

==================================================
19. REACT BITS AUDIT
==================================================

Inspect:

frontend/src/shared/components/react-bits/

For every wrapper report:

- Wrapper name
- Underlying implementation
- Importing pages
- Whether actually used
- Reduced-motion behavior
- Static fallback
- Hydration safety
- Layout-shift risk
- Accessibility
- Theme support
- Performance concerns

Verify:

- Pages use ECHO wrappers rather than raw React Bits components
- Unused wrappers are removed or documented
- No random render-time values
- No global heavy animation loading
- No decorative crisis animation
- No distracting Journal editor animation
- No risk-warning motion
- Authentication motion does not interfere with forms

==================================================
20. UNSPLASH AND IMAGE AUDIT
==================================================

Inspect:

- src/lib/unsplash-images.ts
- next.config.ts
- All next/image usage
- public image assets

Verify:

- Typed image catalog
- No scattered Unsplash URLs
- Correct next/image use
- Correct remote hostname
- Stable dimensions
- Responsive sizes
- Hero priority only where justified
- Lazy loading below the fold
- Meaningful alt text
- Decorative empty alt text
- Image fallbacks
- Text contrast over images
- No fake user or therapist representation
- No fabricated testimonials
- No decorative crisis photography

==================================================
21. FEATURE FUNCTIONALITY AUDIT
==================================================

Audit all controls and states across:

- Landing
- Authentication
- Onboarding
- Dashboard
- Journal
- Buddy
- Emotion insights
- Facial insights
- Risk insights
- Grounding
- Settings
- Crisis support
- Find Help

For every nonfunctional control report:

- Route
- Control label
- File
- Current behavior
- Expected behavior
- Backend dependency
- Recommended phase
- Severity

Do not mark a button functional merely because it has an onClick handler.

Verify that the handler produces the intended user-visible behavior.

==================================================
22. ACCESSIBILITY AUDIT
==================================================

Inspect:

- Skip-to-content
- Heading hierarchy
- Landmarks
- Labels
- aria-describedby
- aria-invalid
- Keyboard navigation
- Visible focus
- Dialog focus trapping
- Focus return
- Escape-to-close
- Sheet accessibility
- Mobile navigation
- Touch-target size
- Color contrast
- Reduced motion
- aria-live regions
- Status announcements
- Chart accessibility
- Image alt text
- No color-only state communication
- No hover-only interaction
- Immediate crisis-resource access

Do not claim WCAG compliance unless appropriate tooling was actually run.

==================================================
23. RESPONSIVE AND PERFORMANCE AUDIT
==================================================

Inspect or test:

- 320px
- 375px
- 768px
- 1024px
- 1440px
- Large desktop

Check:

- Horizontal overflow
- Sidebar overlap
- Bottom-navigation overlap
- Dialog and sheet overflow
- Journal editor usability
- Buddy composer usability
- Image cropping
- Chart responsiveness
- Crisis-action obstruction
- Safe-area spacing

Also inspect:

- Unnecessary Client Components
- Heavy global imports
- Importing all Lucide icons
- React Bits loaded globally
- Charts loaded eagerly
- Large remote images
- Missing next/image sizes
- Layout shifts
- Expensive rerenders
- Hook dependency issues
- Slow typing risks
- Excessive providers
- Duplicate dependencies

Do not invent numerical performance measurements.

==================================================
24. SECURITY AND PRIVACY AUDIT
==================================================

Search for:

- Secrets
- Service-role keys
- API keys
- Password logging
- Token logging
- Journal logging
- Buddy logging
- Facial-data logging
- Sensitive localStorage
- Unsafe HTML
- Raw server errors
- Open redirects
- Fake auth tokens
- Unsupported encryption claims
- Unsupported privacy claims

Do not print secret values.

Redact any sensitive material in reports.

==================================================
25. TEST COVERAGE AUDIT
==================================================

Inventory every test file.

Create a matrix containing:

- Feature
- Test file
- Test type
- Behavior covered
- Missing critical behavior
- Execution result

Check coverage for:

- Models
- Schemas
- DTO mappers
- Error normalization
- API client
- Abort utility
- Services
- Adapters
- ViewModels
- Forms
- Dialogs
- Navigation
- Journal
- Authentication
- React Bits reduced motion
- Image accessibility
- Route smoke tests

Do not fabricate test counts or coverage percentages.

==================================================
26. DOCUMENTATION DRIFT AUDIT
==================================================

Compare every documentation claim against source code.

Identify:

- Features marked complete but missing
- Features marked missing but implemented
- Incorrect route counts
- Incorrect file counts
- Incorrect service-method counts
- Incorrect test counts
- Incorrect ERD counts
- Incorrect commit counts
- Outdated architecture diagrams
- Outdated source trees
- Incorrect React Bits claims
- Incorrect Unsplash claims
- Incorrect migration-status claims
- Legacy files documented as deleted but still active
- MVVM features documented as complete but still using legacy routes

Do not update documentation until evidence has been collected.

==================================================
27. REQUIRED AUDIT DOCUMENTS
==================================================

Create or update:

frontend/src/docs/CODEBASE_AUDIT.md
frontend/src/docs/IMPLEMENTATION_GAP_REPORT.md
frontend/src/docs/PHASE_COMPLETION_MATRIX.md
frontend/src/docs/MVVM_MIGRATION_STATUS.md

CODEBASE_AUDIT.md must contain:

- Executive summary
- Repository status
- Build and test results
- Architecture findings
- Route findings
- UI findings
- Accessibility findings
- Responsive findings
- Performance findings
- Security findings
- Test findings
- Documentation drift
- Overall health

IMPLEMENTATION_GAP_REPORT.md must contain:

- Critical issues
- High-priority issues
- Medium-priority issues
- Low-priority issues
- Missing features
- Partial features
- Backend-dependent limitations
- Recommended implementation order

PHASE_COMPLETION_MATRIX.md must contain:

- Every Phase 0–6 requirement
- Status
- Evidence
- Missing work
- Recommended correction

MVVM_MIGRATION_STATUS.md must contain one table per feature with:

- Legacy implementation path
- New MVVM path
- Model status
- Service status
- ViewModel status
- View status
- Route integration status
- Functional parity
- Legacy deletion status
- Tests
- Migration status
- Next action

==================================================
28. SEVERITY CLASSIFICATION
==================================================

Use:

CRITICAL:
- Secret exposure
- Sensitive-data exposure
- Broken production build
- Unsafe crisis behavior
- Fake production authentication
- Sensitive logging
- Major route failure

HIGH:
- Core feature nonfunctional
- Broken migrated feature
- Major MVVM violation
- Missing critical validation
- Broken critical accessibility
- Fake AI behavior

MEDIUM:
- Partial feature
- Legacy duplication
- Inconsistent component API
- Unnecessary Client Component
- Missing secondary state
- Documentation drift
- Performance concern

LOW:
- Naming inconsistency
- Small duplication
- Cosmetic token inconsistency
- Missing optional test
- Minor documentation issue

Every finding must include:

- ID
- Severity
- Category
- File
- Evidence
- Impact
- Recommended correction
- Recommended phase

==================================================
29. SCORECARD
==================================================

Score each area from 0 to 100:

- Build stability
- Type safety
- MVVM architecture
- Strangler Fig migration quality
- Feature completeness
- UI consistency
- Accessibility
- Responsive design
- Performance
- Security and privacy
- Test coverage
- Documentation accuracy
- Backend readiness

Explain every score using evidence.

Do not inflate scores.

==================================================
30. RECOMMENDED NEXT EXECUTION PLAN
==================================================

Create a prioritized plan based on actual findings.

The plan must include:

- Immediate blockers
- Missing Phase 0–6 corrections
- Features still using legacy architecture
- Features partially migrated
- Safe legacy deletion opportunities
- Best next feature for migration
- Required tests
- Required documentation corrections
- Backend prerequisites
- Suggested commit breakdown

Do not automatically recommend Phase 7.

Recommend Phase 7 only when:

- Earlier architecture foundations are complete
- Journal migration is verified
- No critical or high-priority foundation defects remain
- Route integration is correct
- Legacy duplication is controlled
- Build, type-check, lint, and critical tests pass

==================================================
31. RESTRICTIONS
==================================================

During the audit:

- Do not perform a global rewrite.
- Do not redesign pages.
- Do not migrate another feature.
- Do not install React Router.
- Do not create src/routes/index.tsx.
- Do not create App.tsx.
- Do not duplicate shared component roots.
- Do not delete legacy files without parity verification.
- Do not install React Bits again.
- Do not replace the design system.
- Do not implement the backend.
- Do not integrate Supabase.
- Do not rewrite Git history.
- Do not force push.
- Do not create empty commits.
- Do not silently fix large issues.
- Do not mark missing features complete.
- Do not claim browser testing without browser execution.
- Do not expose secrets.

Allowed changes:

- Create or update the four audit documents.
- Fix a trivial blocker only when it prevents lint, type-check, build, or tests from running.
- Document every such fix.

==================================================
32. FINAL VERIFICATION
==================================================

After creating the audit documents, run:

npm run lint
npm run typecheck
npm run build

Run existing tests again.

Ensure documentation changes do not break the project.

==================================================
33. GIT COMMIT
==================================================

Create one audit commit only when audit documents were legitimately created or modified.

Suggested message:

docs(audit): verify codebase and MVVM migration status

Do not manipulate commit dates unless separately instructed.

Do not include unrelated user changes.

Do not force push.

Push normally only after verification passes.

==================================================
34. FINAL REPORT FORMAT
==================================================

Return:

1. Executive summary
2. Repository and Git status
3. Commit-count and date verification
4. Commands executed
5. Lint result
6. Type-check result
7. Build result
8. Test result
9. Source-tree summary
10. Documentation inventory
11. Phase 0–6 completion
12. Strangler Fig migration assessment
13. Feature migration matrix
14. Route audit
15. MVVM violations
16. Server and Client Component findings
17. Service and adapter findings
18. Legacy-code findings
19. Mock-data findings
20. Shared-component triage
21. Design-system findings
22. React Bits findings
23. Unsplash findings
24. Feature-functionality findings
25. Nonfunctional controls
26. Accessibility findings
27. Responsive findings
28. Performance findings
29. Security and privacy findings
30. Test-coverage findings
31. Documentation drift
32. Critical issues
33. High-priority issues
34. Medium-priority issues
35. Low-priority issues
36. Backend-dependent limitations
37. Overall scorecard
38. Recommended next execution plan
39. Files created
40. Files modified
41. Commit hash
42. Push status
43. Remaining limitations

Use exact paths and evidence.

Do not simply state that the application follows MVVM.

Prove whether each feature has completed:

Legacy → Model → Service → ViewModel → View → Next.js route integration → testing → legacy cleanup

Begin the complete codebase and MVVM migration audit now without asking for additional confirmation.