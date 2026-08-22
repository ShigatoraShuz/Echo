You are a senior software architect and frontend engineer.

TASK:
Refactor the existing ECHO frontend codebase into a clean, consistent MVVM architecture.

IMPORTANT:
DO NOT rewrite the application from scratch.
DO NOT change the application's functionality, UI design, routes, API contracts, or business behavior unless required to fix an architectural issue.

The primary goal is ARCHITECTURAL REFACTORING and FILE STRUCTURE CLEANUP.

==================================================
1. REQUIRED MVVM ARCHITECTURE
==================================================

Every feature under:

src/features/

MUST follow this structure:

feature-name/
├── model/
├── view-model/
├── view/
└── components/

Example:

src/features/journal/

├── model/
│   ├── journal.model.ts
│   ├── journal.dto.ts
│   ├── journal.schema.ts
│   ├── journal.mapper.ts
│   └── journal.constants.ts
│
├── view-model/
│   ├── use-journal-list-view-model.ts
│   ├── use-journal-editor-view-model.ts
│   └── use-journal-detail-view-model.ts
│
├── view/
│   ├── journal-list-view.tsx
│   ├── journal-editor-view.tsx
│   └── journal-detail-view.tsx
│
└── components/
    ├── journal-card.tsx
    ├── journal-editor.tsx
    ├── journal-search.tsx
    └── journal-empty-state.tsx


There should NOT be additional architectural layers inside features such as:

services/
repositories/
api/
controllers/
adapters/

The feature boundary should remain:

MODEL + VIEW-MODEL + VIEW + COMPONENTS


==================================================
2. RESPONSIBILITIES
==================================================

MODEL

Contains:

- Domain models
- Types
- DTOs
- Schemas
- Validation
- Mappers
- Feature constants
- Domain-level data transformations

The Model must NOT contain React UI code.

The Model must NOT render components.

The Model should represent the feature's data and domain rules.


VIEW-MODEL

Contains:

- React hooks responsible for feature state
- UI state
- Form state
- Loading/error states
- User actions
- Event handlers
- Calling application services
- Preparing data for the View
- Coordinating Model + Services

The ViewModel is the main bridge between the View and application logic.

The ViewModel should expose a clean interface such as:

{
    data,
    loading,
    error,
    actions
}

Avoid putting business/application logic directly inside View components.


VIEW

Contains:

- Complete feature screens
- Page-level feature UI
- Composition of components
- Receiving state from ViewModels

Views should primarily render data and connect user interactions to ViewModel actions.

Avoid:

- API calls
- Supabase calls
- business logic
- complex data processing
- direct infrastructure access


COMPONENTS

Contains reusable UI components specific to the feature.

Examples:

journal-card.tsx
journal-search.tsx
journal-editor.tsx
journal-empty-state.tsx

Components should focus primarily on presentation.

If a component contains significant state or feature logic, move that logic into the ViewModel.


==================================================
3. SERVICES MUST BE OUTSIDE FEATURES
==================================================

Create a centralized:

src/services/

structure.

Example:

src/services/
├── authentication/
├── journal/
├── buddy/
├── analysis/
├── dashboard/
├── grounding/
├── settings/
└── verification/

Services are responsible for application/API communication.

Example:

src/services/journal/
├── journal.service.ts
├── journal.http-adapter.ts
├── journal.mock-adapter.ts
└── journal-service.factory.ts

Features should consume services through their ViewModels.

DO NOT place API services inside:

src/features/*/services/


==================================================
4. INFRASTRUCTURE
==================================================

Create:

src/infrastructure/

for external technology implementations.

Example:

src/infrastructure/
├── api/
│   ├── api-client.ts
│   └── auth-token-provider.ts
│
└── supabase/
    ├── browser-client.ts
    ├── server-client.ts
    └── middleware-client.ts

Infrastructure should contain technology-specific implementations.

Examples:

- Supabase
- HTTP client
- external APIs
- authentication providers


==================================================
5. SHARED
==================================================

Use:

src/shared/

for code that is genuinely reusable across multiple unrelated features.

Example:

src/shared/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── navigation/
│   ├── feedback/
│   └── accessibility/
│
├── hooks/
├── types/
├── errors/
└── utils/

IMPORTANT:

Do NOT move feature-specific components into shared.

For example:

journal-card.tsx
MUST remain inside:

features/journal/components/

But:

echo-button.tsx
echo-dialog.tsx
echo-loading-state.tsx

can belong in:

shared/components/


==================================================
6. NEXT.JS APP FOLDER
==================================================

Keep:

src/app/

ONLY for Next.js routing and route composition.

The app folder should NOT contain feature business logic.

Example:

src/app/(protected)/journal/page.tsx

should be very thin.

Example:

import { JournalListView } from "@/features/journal/view";

export default function JournalPage() {
    return <JournalListView />;
}

The actual feature implementation belongs inside:

src/features/journal/


==================================================
7. TARGET ARCHITECTURE
==================================================

The final architecture should resemble:

src/
│
├── app/
│   └── Next.js routes
│
├── features/
│   ├── authentication/
│   │   ├── model/
│   │   ├── view-model/
│   │   ├── view/
│   │   └── components/
│   │
│   ├── onboarding/
│   ├── journal/
│   ├── buddy/
│   ├── analysis/
│   ├── dashboard/
│   ├── grounding/
│   ├── settings/
│   ├── verification/
│   ├── crisis/
│   └── landing/
│
├── services/
│   ├── authentication/
│   ├── journal/
│   ├── buddy/
│   ├── analysis/
│   ├── dashboard/
│   ├── grounding/
│   ├── settings/
│   └── verification/
│
├── infrastructure/
│   ├── api/
│   └── supabase/
│
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── types/
│   ├── errors/
│   └── utils/
│
├── config/
├── theme/
├── i18n/
├── styles/
└── test/


==================================================
8. REFACTORING RULES
==================================================

Before modifying files:

1. Inspect the complete existing frontend.
2. Identify existing architecture.
3. Map every feature to the new structure.
4. Identify duplicated utilities/components.
5. Identify misplaced services.
6. Identify View components containing business logic.
7. Identify ViewModels that are missing or incorrectly implemented.
8. Identify API/infrastructure dependencies.

Then perform the refactor incrementally.

DO NOT blindly move files.

For every moved file:

- Update imports.
- Update aliases.
- Update barrel exports.
- Update tests.
- Update route imports.
- Remove obsolete files.
- Check for circular dependencies.


==================================================
9. FEATURE LIST
==================================================

Preserve and reorganize the existing ECHO features:

- authentication
- onboarding
- journal
- buddy
- dashboard
- grounding
- insights / analysis
- settings
- verification
- landing
- crisis
- public content

Do not unnecessarily merge features.

If "insights" is currently a feature, evaluate whether "analysis" is a better domain name, but preserve existing functionality and routes.


==================================================
10. DEPENDENCY DIRECTION
==================================================

Follow this dependency direction:

VIEW
  ↓
VIEW-MODEL
  ↓
SERVICES
  ↓
INFRASTRUCTURE


MODEL may be used by:

VIEW
VIEW-MODEL
SERVICES

Shared code should remain independent of specific features whenever possible.

Avoid:

VIEW → API
VIEW → Supabase
VIEW → Infrastructure

Avoid:

MODEL → React UI

Avoid:

SHARED → FEATURE

Avoid circular dependencies.


==================================================
11. COMPONENT RULES
==================================================

Feature components stay inside:

features/<feature>/components/

Shared components stay inside:

shared/components/

Do not create unnecessary abstraction.

Do not move everything into shared just to reduce duplication.

A component should only become shared when it is genuinely reusable across multiple features.


==================================================
12. TESTING
==================================================

Move tests alongside their appropriate architectural layer where practical.

Examples:

model/
├── journal.schema.ts
└── journal.schema.test.ts

view-model/
├── use-journal-list-view-model.ts
└── use-journal-list-view-model.test.ts

components/
├── journal-card.tsx
└── journal-card.test.tsx

Preserve all existing tests.

Do not delete tests simply because files moved.

After refactoring:

- Run TypeScript checks.
- Run ESLint.
- Run unit tests.
- Run component tests.
- Verify Next.js build.
- Verify all routes compile.


==================================================
13. DO NOT CHANGE
==================================================

Unless absolutely necessary, DO NOT change:

- UI appearance
- UX behavior
- API endpoints
- backend contracts
- Supabase schema
- authentication behavior
- feature functionality
- database logic
- security mechanisms
- environment variables
- existing business rules


==================================================
14. CLEANUP
==================================================

After migration:

- Remove empty directories.
- Remove obsolete files.
- Remove duplicate implementations.
- Remove unused imports.
- Remove dead code.
- Remove unnecessary barrel files.
- Fix naming inconsistencies.
- Ensure naming follows one convention.

Use consistent naming:

Models:
feature.model.ts

DTO:
feature.dto.ts

Schema:
feature.schema.ts

Mapper:
feature.mapper.ts

ViewModel:
use-feature-view-model.ts

View:
feature-view.tsx

Component:
feature-card.tsx


==================================================
15. DOCUMENTATION
==================================================

Update the architecture documentation after the refactor.

Create/update:

src/docs/FRONTEND_ARCHITECTURE.md

Document:

- MVVM architecture
- Model responsibilities
- ViewModel responsibilities
- View responsibilities
- Component responsibilities
- Service layer
- Infrastructure layer
- Shared layer
- Dependency direction
- Example feature structure

Keep the documentation concise and aligned with the actual implementation.


==================================================
16. IMPORTANT ECHO ARCHITECTURE PRINCIPLE
==================================================

ECHO should follow:

FEATURE
    ↓
MODEL
    ↓
VIEW-MODEL
    ↓
VIEW
    ↓
COMPONENTS

with external communication handled through:

VIEW-MODEL
    ↓
SERVICE
    ↓
INFRASTRUCTURE
    ↓
BACKEND API


The goal is a clean, maintainable, testable architecture suitable for a university thesis project and future production development.


==================================================
17. FINAL VALIDATION
==================================================

At the end, provide a concise report containing:

1. Files/directories created
2. Files/directories moved
3. Files removed
4. Features migrated
5. Services extracted
6. Infrastructure extracted
7. Shared components extracted
8. MVVM violations fixed
9. Tests executed
10. TypeScript/ESLint/build status
11. Any remaining architectural issues

IMPORTANT:

Do not stop after creating folders.

Actually migrate the existing implementation into the new architecture.

The final codebase must compile and preserve the existing ECHO functionality.