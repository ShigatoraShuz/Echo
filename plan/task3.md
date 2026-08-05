# Echo Codebase Refactoring and Architecture Plan

**Document:** `plan3.md`  
**Project:** Echo  
**Purpose:** Refactor the existing Echo application into a clean, maintainable, secure, and production-oriented workspace using a Next.js MVVM frontend, a Node.js Express backend, a FastAPI fine-tuned LLM inference service, and Supabase for authentication, PostgreSQL, storage, and Row-Level Security.

---

# 1. Executive Summary

Echo is a mental-health journaling and insight application that will use a fine-tuned large language model to estimate PHQ-8-related depression severity from journal text. The application must clearly separate frontend presentation, application logic, model inference, and data persistence.

The recommended architecture is:

```text
Next.js Frontend
    ↓
Node.js Express API
    ├── Supabase Auth and PostgreSQL
    └── FastAPI AI Inference Service
            ↓
      Fine-Tuned LLM
```

The main architectural rule is:

```text
Frontend handles presentation and client interaction.
Node.js handles business logic, authorization, and workflows.
FastAPI handles model inference and AI-specific preprocessing.
Supabase handles authentication, database persistence, storage, and RLS.
```

The frontend must not call the FastAPI service directly. All AI requests must pass through the Node.js backend so the backend can validate authentication, verify consent, check ownership, apply rate limits, save journal records, call the AI service, validate the AI output, and persist the result.

This plan is designed for incremental migration. Existing working features, routes, pages, authentication, layouts, and styles must be preserved while the project is reorganized.

---

# 2. Primary Objectives

The refactor must accomplish the following:

1. Convert the frontend into a feature-based MVVM architecture.
2. Keep Next.js App Router as the routing system.
3. Create a tailored Node.js Express backend using feature-based modules.
4. Create a separate FastAPI inference service for the fine-tuned model.
5. Move all persistent data operations into Supabase repositories and migrations.
6. Establish strict boundaries between frontend, backend, AI service, and database.
7. Add shared contracts to prevent response mismatches.
8. Add centralized validation, error handling, logging, and request tracing.
9. Add Supabase Row-Level Security for every user-owned table.
10. Preserve all currently working user-facing behavior.
11. Make the repository easier to navigate, test, deploy, and maintain.
12. Prevent private model artifacts, datasets, journal text, and secret keys from entering Git.
13. Add architecture, API, security, and migration documentation.
14. Prepare the codebase for local development and future production deployment.

---

# 3. Non-Negotiable Architecture Rules

The refactor must enforce these rules.

## 3.1 Frontend rules

- Use Next.js App Router.
- Do not add React Router.
- Keep route files under `src/app/`.
- Keep every `page.tsx` file thin.
- Store feature UI inside `features/[feature]/view/`.
- Store UI state and feature coordination inside `features/[feature]/viewmodel/`.
- Store domain types, schemas, constants, and mappers inside `features/[feature]/model/`.
- Store API calls inside feature services or shared API services.
- Do not place direct database queries inside React components.
- Do not call FastAPI from the browser.
- Do not expose server-only keys to the browser.
- Do not place large UI components directly in `page.tsx`.

## 3.2 Node.js backend rules

- Use Node.js, Express, and TypeScript.
- Use feature-based backend modules.
- Routes contain route declarations only.
- Controllers handle HTTP concerns only.
- Services contain business logic.
- Repositories contain Supabase database operations.
- Validators use Zod.
- The backend derives the user ID from the verified access token.
- Never trust `user_id` from request bodies.
- Centralize error handling.
- Add request IDs for tracing.
- Do not log journal contents.
- Validate all FastAPI responses before persistence.

## 3.3 FastAPI rules

- The fine-tuned model must be loaded once at startup.
- The AI service must run separately from Node.js.
- The AI service must return strict structured JSON.
- The AI service must not become the main application backend.
- The AI service must not manage profiles, permissions, user settings, or frontend workflows.
- Use deterministic inference by default.
- Detect urgent language independently from the PHQ-8 score.
- Include model version metadata in every analysis response.
- Use one worker by default for an 8 GB GPU unless memory tests prove otherwise.
- Do not log raw journal content, prompts, or full model outputs.

## 3.4 Supabase rules

- Use Supabase Auth for authentication.
- Use PostgreSQL for persistent data.
- Enable RLS on every user-owned table.
- Restrict access using `auth.uid()` ownership checks.
- Use both `USING` and `WITH CHECK` on update policies.
- Do not expose the service-role key to the frontend.
- Do not use editable user metadata for authorization decisions.
- Create migrations using the Supabase CLI.
- Add database tests for ownership and unauthorized access.

---

# 4. Target Repository Structure

The final repository should follow this structure:

```text
Echo/
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
├── package.json
├── package-lock.json
├── tsconfig.base.json
├── turbo.json
│
├── frontend/
├── backend/
├── ai-service/
├── supabase/
├── ml/
├── packages/
├── docs/
├── assets/
├── scripts/
├── plan/
└── .github/
```

Detailed root structure:

```text
Echo/
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
├── package.json
├── package-lock.json
├── tsconfig.base.json
├── turbo.json
│
├── design-qa.md
│
├── plan/
│   ├── task.md
│   ├── task2.md
│   └── plan3.md
│
├── assets/
│   ├── design/
│   │   ├── echo-landing-seamless-sections.png
│   │   └── references/
│   └── branding/
│
├── frontend/
├── backend/
├── ai-service/
├── supabase/
├── ml/
├── packages/
├── docs/
├── scripts/
└── .github/
```

---

# 5. Current Codebase Audit Plan

Before moving files, perform a complete audit.

Create:

```text
docs/refactoring/current-codebase-audit.md
```

The audit must include the following sections.

## 5.1 Repository inventory

Record:

- Root files.
- Frontend configuration files.
- Existing routes.
- Existing feature folders.
- Existing reusable components.
- Existing Supabase clients.
- Existing authentication logic.
- Existing API calls.
- Existing test files.
- Existing static assets.
- Existing environment variables.
- Existing generated output folders.
- Existing temporary folders.
- Existing docs and planning files.

## 5.2 Route inventory

For each Next.js route, document:

| Route | Access | Current Page File | Intended Feature | Notes |
|---|---|---|---|---|
| `/` | Public | `src/app/(public)/page.tsx` | Landing | Preserve |
| `/login` | Public | `src/app/(auth)/login/page.tsx` | Authentication | Preserve |
| `/signup` | Public | `src/app/(auth)/signup/page.tsx` | Authentication | Preserve |
| `/dashboard` | Protected | `src/app/(protected)/dashboard/page.tsx` | Dashboard | Refactor to MVVM |
| `/journal` | Protected | `src/app/(protected)/journal/page.tsx` | Journal | Refactor to MVVM |
| `/journal/new` | Protected | `src/app/(protected)/journal/new/page.tsx` | Journal | Refactor to MVVM |
| `/journal/[id]` | Protected | `src/app/(protected)/journal/[id]/page.tsx` | Journal | Refactor to MVVM |

Continue the table for all existing routes.

## 5.3 Component audit

Classify every major component as one of:

- Page shell.
- Feature View.
- Feature component.
- Shared reusable component.
- Provider.
- Navigation component.
- Layout component.
- Legacy component.
- Dead or duplicate component.

## 5.4 Mixed-responsibility audit

Find files that mix:

- Rendering and API requests.
- Rendering and Supabase queries.
- Rendering and validation logic.
- Form state and persistence logic.
- Route logic and business logic.
- Authentication checks and UI layout.
- AI analysis calls and display code.

For each file, record:

```text
Current file:
Current responsibilities:
Problems:
Target feature:
Target View:
Target ViewModel:
Target Model:
Target Service:
Migration risk:
```

## 5.5 Dependency audit

Identify:

- Circular imports.
- Deep relative imports.
- Cross-feature imports.
- Shared code importing feature code.
- Duplicate utility functions.
- Duplicate types.
- Duplicate Supabase clients.
- Direct frontend database access.
- Direct frontend AI calls.

## 5.6 Asset audit

Review:

```text
frontend/assets/
frontend/outputs/
frontend/work/
```

Classify files as:

- Public frontend asset.
- Design reference.
- Generated output.
- Temporary working file.
- Duplicate.
- Unused.

Do not delete an asset until all code references have been checked.

---

# 6. Frontend MVVM Target Structure

The frontend should become:

```text
frontend/
├── README.md
├── package.json
├── package-lock.json
├── next.config.ts
├── next-env.d.ts
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── .env.example
│
├── public/
│   ├── images/
│   │   ├── landing/
│   │   ├── authentication/
│   │   ├── dashboard/
│   │   ├── journal/
│   │   ├── buddy/
│   │   ├── insights/
│   │   ├── settings/
│   │   └── backgrounds/
│   ├── icons/
│   ├── videos/
│   └── fonts/
│
└── src/
    ├── app/
    ├── features/
    ├── shared-components/
    ├── routes/
    ├── services/
    ├── lib/
    ├── config/
    ├── providers/
    ├── hooks/
    ├── types/
    ├── styles/
    ├── test/
    └── docs/
```

---

# 7. Frontend App Router Structure

Keep routing under `src/app/`.

```text
frontend/src/app/
├── layout.tsx
├── globals.css
├── loading.tsx
├── error.tsx
├── not-found.tsx
├── icon.svg
│
├── design-system/
│   └── page.tsx
│
├── crisis/
│   └── page.tsx
├── crisis-help/
│   └── page.tsx
├── support/
│   └── find-help/
│       └── page.tsx
│
├── (public)/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── about/
│   │   └── page.tsx
│   ├── privacy-policy/
│   │   └── page.tsx
│   └── terms/
│       └── page.tsx
│
├── (auth)/
│   ├── layout.tsx
│   ├── login/
│   │   └── page.tsx
│   ├── signup/
│   │   └── page.tsx
│   ├── forgot-password/
│   │   └── page.tsx
│   ├── reset-password/
│   │   └── page.tsx
│   └── callback/
│       └── route.ts
│
├── (onboarding)/
│   ├── layout.tsx
│   └── onboarding/
│       ├── setup/
│       │   └── page.tsx
│       ├── profile/
│       │   └── page.tsx
│       └── consent/
│           └── page.tsx
│
└── (protected)/
    ├── layout.tsx
    ├── dashboard/
    │   └── page.tsx
    ├── buddy/
    │   ├── page.tsx
    │   └── history/
    │       └── page.tsx
    ├── journal/
    │   ├── page.tsx
    │   ├── new/
    │   │   └── page.tsx
    │   └── [id]/
    │       └── page.tsx
    ├── tools/
    │   └── grounding/
    │       └── page.tsx
    ├── insights/
    │   ├── emotion/
    │   │   └── page.tsx
    │   ├── facial/
    │   │   └── page.tsx
    │   └── risk/
    │       └── page.tsx
    └── settings/
        ├── profile/
        │   └── page.tsx
        ├── notifications/
        │   └── page.tsx
        ├── security/
        │   └── page.tsx
        ├── privacy/
        │   └── page.tsx
        ├── trusted-contacts/
        │   └── page.tsx
        └── export/
            └── page.tsx
```

Every page file should only import and render its feature View.

Example:

```tsx
import { JournalCreateView } from "@/features/journal";

export default function NewJournalPage() {
  return <JournalCreateView />;
}
```

Dynamic route example:

```tsx
import { JournalDetailsView } from "@/features/journal";

type JournalDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function JournalDetailsPage({
  params,
}: JournalDetailsPageProps) {
  const { id } = await params;
  return <JournalDetailsView journalId={id} />;
}
```

---

# 8. Frontend Feature Structure

Every feature should use this template:

```text
frontend/src/features/[feature-name]/
├── view/
├── viewmodel/
├── model/
├── components/
├── services/
├── types/
├── constants/
├── tests/
└── index.ts
```

Minimum MVVM structure:

```text
features/
└── [feature-name]/
    ├── view/
    │   └── [FeatureName]View.tsx
    ├── viewmodel/
    │   └── use[FeatureName]ViewModel.ts
    ├── model/
    │   └── [featureName].model.ts
    └── index.ts
```

Recommended full structure:

```text
features/journal/
├── view/
│   ├── JournalListView.tsx
│   ├── JournalCreateView.tsx
│   └── JournalDetailsView.tsx
│
├── viewmodel/
│   ├── useJournalListViewModel.ts
│   ├── useJournalCreateViewModel.ts
│   └── useJournalDetailsViewModel.ts
│
├── model/
│   ├── journal.model.ts
│   ├── journal.schema.ts
│   ├── journal.mapper.ts
│   ├── journal.constants.ts
│   └── journal.state.ts
│
├── components/
│   ├── JournalCard.tsx
│   ├── JournalEditor.tsx
│   ├── JournalList.tsx
│   ├── JournalEmptyState.tsx
│   ├── JournalAnalysisPanel.tsx
│   ├── JournalStatusBadge.tsx
│   └── JournalDeleteDialog.tsx
│
├── services/
│   └── journal.service.ts
│
├── types/
│   ├── journal.types.ts
│   └── journal-api.types.ts
│
├── constants/
│   └── journal.constants.ts
│
├── tests/
│   ├── JournalCreateView.test.tsx
│   ├── useJournalCreateViewModel.test.ts
│   └── journal.mapper.test.ts
│
└── index.ts
```

---

# 9. Frontend Feature Inventory

Create these feature folders:

```text
frontend/src/features/
├── authentication/
├── dashboard/
├── journal/
├── insights/
├── buddy/
├── grounding/
├── onboarding/
├── settings/
├── crisis-support/
├── landing/
└── public-content/
```

## 9.1 Authentication

```text
features/authentication/
├── view/
│   ├── LoginView.tsx
│   ├── SignupView.tsx
│   ├── ForgotPasswordView.tsx
│   └── ResetPasswordView.tsx
├── viewmodel/
│   ├── useLoginViewModel.ts
│   ├── useSignupViewModel.ts
│   ├── useForgotPasswordViewModel.ts
│   └── useResetPasswordViewModel.ts
├── model/
│   ├── authentication.model.ts
│   ├── authentication.schema.ts
│   └── authentication.mapper.ts
├── components/
│   ├── AuthForm.tsx
│   ├── OAuthButton.tsx
│   ├── PasswordField.tsx
│   └── AuthErrorMessage.tsx
├── services/
│   └── authentication.service.ts
└── index.ts
```

Responsibilities:

- Sign in.
- Sign up.
- Google OAuth.
- Password reset.
- Session handling.
- Authentication error normalization.

## 9.2 Dashboard

```text
features/dashboard/
├── view/
│   └── DashboardView.tsx
├── viewmodel/
│   └── useDashboardViewModel.ts
├── model/
│   ├── dashboard.model.ts
│   └── dashboard.mapper.ts
├── components/
│   ├── WelcomeHeader.tsx
│   ├── MoodSummaryCard.tsx
│   ├── RecentJournalCard.tsx
│   ├── InsightSummaryCard.tsx
│   ├── GroundingShortcutCard.tsx
│   └── SupportShortcutCard.tsx
├── services/
│   └── dashboard.service.ts
└── index.ts
```

Responsibilities:

- Fetch dashboard summary.
- Display recent journal entries.
- Display recent insight status.
- Display mood overview.
- Link to journaling and support tools.

## 9.3 Journal

Responsibilities:

- Create journal entry.
- Update journal entry.
- Read journal entry.
- Delete or archive journal entry.
- Request AI analysis.
- Poll or refresh analysis status.
- Display non-diagnostic analysis result.
- Handle failed analysis safely.

## 9.4 Insights

```text
features/insights/
├── view/
│   ├── EmotionInsightsView.tsx
│   ├── FacialInsightsView.tsx
│   └── RiskInsightsView.tsx
├── viewmodel/
│   ├── useEmotionInsightsViewModel.ts
│   ├── useFacialInsightsViewModel.ts
│   └── useRiskInsightsViewModel.ts
├── model/
│   ├── insight.model.ts
│   ├── insight.mapper.ts
│   └── insight.constants.ts
├── components/
├── services/
│   └── insight.service.ts
└── index.ts
```

## 9.5 Buddy

Responsibilities:

- Display conversational support UI.
- Preserve history if the feature requires it.
- Avoid presenting the buddy as a clinician.
- Display escalation and crisis support actions when needed.

## 9.6 Grounding

Responsibilities:

- Guided breathing or grounding exercises.
- Timer state.
- Step progression.
- Completion state.
- No backend dependency unless history is stored.

## 9.7 Onboarding

Responsibilities:

- Profile setup.
- Consent collection.
- Privacy explanation.
- Trusted-contact setup if included.
- Completion status.

## 9.8 Settings

Subfeatures:

- Profile.
- Notifications.
- Privacy.
- Security.
- Trusted contacts.
- Data export.
- Account deletion.

---

# 10. MVVM Responsibility Definitions

## 10.1 View

A View is responsible for:

- Rendering JSX.
- Layout and visual composition.
- Displaying values from a ViewModel.
- Calling handlers exposed by a ViewModel.
- Rendering loading, error, empty, and success states.
- Formatting values for presentation.

A View must not:

- Query Supabase directly.
- Call `fetch` directly.
- Call FastAPI.
- Contain authorization rules.
- Contain complex business logic.
- Parse backend error payloads.
- Build API URLs manually.

Example:

```tsx
"use client";

import { JournalEditor } from "../components/JournalEditor";
import { useJournalCreateViewModel } from "../viewmodel/useJournalCreateViewModel";

export function JournalCreateView() {
  const vm = useJournalCreateViewModel();

  return (
    <main>
      <JournalEditor
        title={vm.title}
        content={vm.content}
        errors={vm.errors}
        isSubmitting={vm.isSubmitting}
        onTitleChange={vm.handleTitleChange}
        onContentChange={vm.handleContentChange}
        onSubmit={vm.handleSubmit}
        onCancel={vm.handleCancel}
      />
    </main>
  );
}
```

## 10.2 ViewModel

A ViewModel is responsible for:

- Form state.
- Loading state.
- Error state.
- Success state.
- Calling feature services.
- Coordinating navigation.
- Mapping backend responses into view-friendly state.
- Exposing explicit handlers.

A ViewModel must not:

- Render JSX.
- Contain reusable UI components.
- Query Supabase directly.
- Know FastAPI details.
- Access service-role credentials.

Example:

```ts
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { journalService } from "../services/journal.service";
import { journalCreateSchema } from "../model/journal.schema";
import { ROUTES } from "@/routes";

export function useJournalCreateViewModel() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const parsed = journalCreateSchema.safeParse({ title, content });

    if (!parsed.success) {
      setErrors(/* map validation errors */ {});
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const journal = await journalService.create(parsed.data);
      router.push(ROUTES.journalDetails(journal.id));
    } catch (error) {
      setErrors({ form: "Unable to save the journal entry." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    title,
    content,
    errors,
    isSubmitting,
    handleTitleChange: setTitle,
    handleContentChange: setContent,
    handleSubmit,
    handleCancel: () => router.push(ROUTES.journal),
  };
}
```

## 10.3 Model

A Model is responsible for:

- Domain types.
- Schemas.
- Constants.
- Mappers.
- Status definitions.
- Data normalization.

Example:

```ts
export type JournalAnalysisStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  entryDate: string;
  analysisStatus: JournalAnalysisStatus;
  createdAt: string;
  updatedAt: string;
}
```

## 10.4 Service

A frontend feature service is responsible for:

- Calling the Node.js backend.
- Supplying the Supabase access token when needed.
- Mapping API data into feature models.
- Throwing normalized application errors.

Example:

```ts
import { apiClient } from "@/services/api-client";
import type { CreateJournalInput, JournalEntry } from "../model/journal.model";

export const journalService = {
  async create(input: CreateJournalInput): Promise<JournalEntry> {
    return apiClient.post<JournalEntry>("/journals", input);
  },
};
```

---

# 11. Shared Components Structure

Use the requested shared component structure:

```text
frontend/src/shared-components/
├── Button/
│   ├── Button.tsx
│   ├── Button.test.tsx
│   ├── Button.types.ts
│   └── index.ts
├── Card/
├── Input/
├── Textarea/
├── Select/
├── Checkbox/
├── Modal/
├── Dialog/
├── Spinner/
├── EmptyState/
├── ErrorState/
├── PageHeader/
├── Sidebar/
├── TopNavigation/
├── DropdownMenu/
├── Avatar/
├── Badge/
├── Toast/
├── Tabs/
├── Skeleton/
├── ConfirmationDialog/
└── CrisisBanner/
```

Rules:

- Shared components must not import feature code.
- Shared components should be generic.
- Shared components should accept data and callbacks through props.
- Shared components should not call backend services.
- Shared components should not know about journal, dashboard, or analysis domain rules unless they are explicitly domain-specific and moved into a feature folder.

---

# 12. Frontend Route Registry

Create:

```text
frontend/src/routes/index.ts
```

Example:

```ts
export const ROUTES = {
  home: "/",
  about: "/about",
  privacyPolicy: "/privacy-policy",
  terms: "/terms",

  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",

  onboardingSetup: "/onboarding/setup",
  onboardingProfile: "/onboarding/profile",
  onboardingConsent: "/onboarding/consent",

  dashboard: "/dashboard",
  journal: "/journal",
  journalNew: "/journal/new",
  journalDetails: (id: string) => `/journal/${id}`,

  buddy: "/buddy",
  buddyHistory: "/buddy/history",

  grounding: "/tools/grounding",

  emotionInsights: "/insights/emotion",
  facialInsights: "/insights/facial",
  riskInsights: "/insights/risk",

  settingsProfile: "/settings/profile",
  settingsNotifications: "/settings/notifications",
  settingsSecurity: "/settings/security",
  settingsPrivacy: "/settings/privacy",
  settingsTrustedContacts: "/settings/trusted-contacts",
  settingsExport: "/settings/export",

  crisis: "/crisis",
  crisisHelp: "/crisis-help",
  findHelp: "/support/find-help",
} as const;
```

Create:

```text
frontend/src/docs/ROUTES.md
```

Include:

| Route | Access Level | Page File | Feature View | Description |
|---|---|---|---|---|

---

# 13. Frontend API Layer

Create:

```text
frontend/src/services/
├── api-client.ts
├── auth-token.service.ts
├── journal-api.service.ts
├── analysis-api.service.ts
├── dashboard-api.service.ts
├── profile-api.service.ts
├── consent-api.service.ts
├── notification-api.service.ts
├── trusted-contact-api.service.ts
└── export-api.service.ts
```

## 13.1 API client responsibilities

The API client must:

- Read `NEXT_PUBLIC_API_URL`.
- Add `Content-Type: application/json`.
- Add the Supabase bearer token.
- Add a request ID when appropriate.
- Parse JSON responses.
- Normalize backend errors.
- Support GET, POST, PATCH, PUT, and DELETE.
- Reject unexpected non-JSON responses.
- Avoid exposing raw backend stack traces.

Suggested error type:

```ts
export interface ApiErrorPayload {
  code: string;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
}
```

---

# 14. Frontend Supabase Integration

Create:

```text
frontend/src/lib/supabase/
├── browser-client.ts
├── server-client.ts
├── middleware-client.ts
└── auth-helpers.ts
```

The frontend Supabase client may be used for:

- Sign in.
- Sign up.
- OAuth.
- Sign out.
- Session refresh.
- Reading the authenticated session.

The frontend must not use a service-role key.

Protected application data should be requested from Node.js.

---

# 15. Frontend Path Aliases

Update `frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/features/*": ["./src/features/*"],
      "@/shared-components/*": ["./src/shared-components/*"],
      "@/services/*": ["./src/services/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/config/*": ["./src/config/*"],
      "@/routes": ["./src/routes/index.ts"]
    }
  }
}
```

Replace imports such as:

```ts
../../../../shared/components/Button
```

with:

```ts
@/shared-components/Button
```

Allowed dependency direction:

```text
app
  → features
      → shared-components
      → services
      → models
      → lib
```

Forbidden dependency examples:

```text
shared-components → features
model → view
service → view
lib → feature
```

---

# 16. Frontend Asset Migration

Current assets should be moved from:

```text
frontend/assets/
```

into:

```text
frontend/public/
```

Suggested migration:

```text
frontend/assets/bg.png
→ frontend/public/images/backgrounds/bg.png

frontend/assets/3bg.png
→ frontend/public/images/backgrounds/3bg.png

frontend/assets/auth-celestial-background.png
→ frontend/public/images/authentication/celestial-background.png

frontend/assets/auth-grid-background.png
→ frontend/public/images/authentication/grid-background.png

frontend/assets/growth-doorway-hill.png
→ frontend/public/images/landing/growth-doorway-hill.png

frontend/assets/Landing Page/image 1.jpg
→ frontend/public/images/landing/image-01.jpg
```

Rules:

- Rename files to lowercase kebab-case.
- Correct obvious filename errors.
- Update every import or public path.
- Confirm no route or component still references the old location.
- Move design-only images to `assets/design/` instead of `frontend/public/`.

Remove or relocate:

```text
frontend/outputs/
frontend/work/
```

Target locations:

```text
ml/outputs/
work/
```

---

# 17. Node.js Express Backend Target Structure

Create:

```text
backend/
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── Dockerfile
├── .env.example
│
├── src/
│   ├── config/
│   ├── shared/
│   ├── infrastructure/
│   ├── features/
│   ├── routes/
│   ├── app.ts
│   └── server.ts
│
└── tests/
```

Detailed structure:

```text
backend/src/
├── config/
│   ├── environment.ts
│   ├── database.ts
│   ├── cors.ts
│   ├── security.ts
│   ├── rate-limit.ts
│   ├── logger.ts
│   └── application.ts
│
├── shared/
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── validation.middleware.ts
│   │   ├── rate-limit.middleware.ts
│   │   ├── request-id.middleware.ts
│   │   ├── not-found.middleware.ts
│   │   └── consent.middleware.ts
│   │
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── async-handler.ts
│   │   ├── response.ts
│   │   ├── pagination.ts
│   │   ├── encryption.ts
│   │   ├── redaction.ts
│   │   └── timing.ts
│   │
│   ├── errors/
│   │   ├── app-error.ts
│   │   ├── validation-error.ts
│   │   ├── authentication-error.ts
│   │   ├── authorization-error.ts
│   │   ├── not-found-error.ts
│   │   ├── conflict-error.ts
│   │   ├── rate-limit-error.ts
│   │   └── external-service-error.ts
│   │
│   ├── types/
│   │   ├── express.d.ts
│   │   ├── api-response.ts
│   │   ├── authenticated-user.ts
│   │   ├── pagination.ts
│   │   └── request-context.ts
│   │
│   ├── constants/
│   │   ├── error-codes.ts
│   │   ├── headers.ts
│   │   └── limits.ts
│   │
│   └── validation/
│       ├── common.schema.ts
│       └── validation-result.ts
│
├── infrastructure/
│   ├── supabase/
│   │   ├── supabase-admin.client.ts
│   │   ├── supabase-user.client.ts
│   │   ├── database.types.ts
│   │   ├── supabase-health.ts
│   │   └── supabase-errors.ts
│   │
│   ├── ai/
│   │   ├── ai.client.ts
│   │   ├── ai.contract.ts
│   │   ├── ai.response.schema.ts
│   │   ├── ai.errors.ts
│   │   ├── ai-health.ts
│   │   └── ai-auth.ts
│   │
│   ├── storage/
│   │   ├── storage.client.ts
│   │   └── storage.errors.ts
│   │
│   ├── notifications/
│   │   ├── notification.client.ts
│   │   └── notification.errors.ts
│   │
│   └── monitoring/
│       ├── metrics.ts
│       └── health-checks.ts
│
├── features/
│   ├── health/
│   ├── authentication/
│   ├── profiles/
│   ├── journals/
│   ├── analyses/
│   ├── insights/
│   ├── mood-entries/
│   ├── user-consents/
│   ├── trusted-contacts/
│   ├── notifications/
│   ├── notification-preferences/
│   ├── exports/
│   ├── crisis-support/
│   ├── model-versions/
│   └── audit-events/
│
├── routes/
│   ├── index.ts
│   └── v1.routes.ts
│
├── app.ts
└── server.ts
```

---

# 18. Backend Feature Template

Every backend feature should follow:

```text
backend/src/features/[feature-name]/
├── [feature-name].routes.ts
├── [feature-name].controller.ts
├── [feature-name].service.ts
├── [feature-name].repository.ts
├── [feature-name].validator.ts
├── [feature-name].model.ts
├── [feature-name].mapper.ts
├── [feature-name].types.ts
├── [feature-name].constants.ts
└── index.ts
```

Example:

```text
backend/src/features/journals/
├── journals.routes.ts
├── journals.controller.ts
├── journals.service.ts
├── journals.repository.ts
├── journals.validator.ts
├── journals.model.ts
├── journals.mapper.ts
├── journals.types.ts
├── journals.constants.ts
└── index.ts
```

---

# 19. Backend Responsibility Rules

## 19.1 Routes

Routes must:

- Define HTTP paths.
- Apply authentication middleware.
- Apply authorization middleware.
- Apply validation middleware.
- Call controller methods.

Routes must not:

- Query Supabase.
- Call FastAPI directly.
- Contain business logic.
- Format database records.

## 19.2 Controllers

Controllers must:

- Read validated request input.
- Read authenticated user context.
- Call the service.
- Return standardized responses.

Controllers must not:

- Contain database queries.
- Contain model inference logic.
- Contain ownership rules.
- Contain complex calculations.

## 19.3 Services

Services must:

- Contain business logic.
- Enforce ownership and application rules.
- Coordinate repositories.
- Coordinate the AI client.
- Handle transaction-like workflows.
- Map application failures into domain errors.

Services must not:

- Depend on Express `Request` or `Response`.
- Return raw Supabase errors.
- Return raw FastAPI errors.

## 19.4 Repositories

Repositories must:

- Query Supabase.
- Insert, update, select, and delete records.
- Map database records into domain models.
- Enforce filtering by user ownership where appropriate.

Repositories must not:

- Handle HTTP status codes.
- Call frontend code.
- Call the AI model.
- Contain UI logic.

## 19.5 Validators

Validators must:

- Use Zod.
- Validate request bodies.
- Validate path parameters.
- Validate query strings.
- Validate FastAPI responses.

---

# 20. Backend API Endpoints

Use versioned routes:

```text
/api/v1
```

Recommended endpoints:

## 20.1 Health

```text
GET /api/v1/health
GET /api/v1/health/ready
```

## 20.2 Profiles

```text
GET    /api/v1/profiles/me
PATCH  /api/v1/profiles/me
DELETE /api/v1/profiles/me
```

## 20.3 Journals

```text
GET    /api/v1/journals
POST   /api/v1/journals
GET    /api/v1/journals/:journalId
PATCH  /api/v1/journals/:journalId
DELETE /api/v1/journals/:journalId
```

## 20.4 Analyses

```text
POST /api/v1/journals/:journalId/analyses
GET  /api/v1/journals/:journalId/analyses/latest
GET  /api/v1/analyses/:analysisId
POST /api/v1/analyses/:analysisId/retry
```

## 20.5 Insights

```text
GET /api/v1/insights/summary
GET /api/v1/insights/emotions
GET /api/v1/insights/risk
```

## 20.6 Mood entries

```text
GET    /api/v1/mood-entries
POST   /api/v1/mood-entries
PATCH  /api/v1/mood-entries/:moodEntryId
DELETE /api/v1/mood-entries/:moodEntryId
```

## 20.7 Consent

```text
GET  /api/v1/consents
POST /api/v1/consents
POST /api/v1/consents/:consentType/revoke
```

## 20.8 Trusted contacts

```text
GET    /api/v1/trusted-contacts
POST   /api/v1/trusted-contacts
PATCH  /api/v1/trusted-contacts/:contactId
DELETE /api/v1/trusted-contacts/:contactId
```

## 20.9 Notifications

```text
GET   /api/v1/notifications
PATCH /api/v1/notifications/:notificationId/read
PATCH /api/v1/notifications/read-all
```

## 20.10 Exports

```text
POST /api/v1/exports
GET  /api/v1/exports/:exportId
```

---

# 21. Backend Application Setup

## 21.1 `app.ts`

`app.ts` must:

- Create the Express application.
- Add security headers.
- Configure CORS.
- Configure JSON body size limits.
- Add request IDs.
- Add structured request logging.
- Add global rate limiting.
- Register `/api/v1` routes.
- Register not-found middleware.
- Register centralized error middleware.
- Export the app without starting the server.

Example responsibilities:

```ts
const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(globalRateLimitMiddleware);
app.use("/api/v1", v1Routes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export { app };
```

## 21.2 `server.ts`

`server.ts` must:

- Validate environment variables.
- Start the server.
- Log startup information.
- Handle `SIGINT` and `SIGTERM`.
- Shut down gracefully.
- Close active resources.

---

# 22. Backend Authentication and Authorization

Authentication flow:

```text
Frontend signs in with Supabase Auth
    ↓
Frontend receives access token
    ↓
Frontend calls Node.js with Bearer token
    ↓
Node.js validates token with Supabase
    ↓
Node.js attaches authenticated user context
    ↓
Feature service verifies ownership and permissions
```

Create:

```text
backend/src/shared/middleware/auth.middleware.ts
```

It must:

1. Read the `Authorization` header.
2. Require `Bearer <token>`.
3. Validate the user with Supabase.
4. Reject expired or invalid tokens.
5. Add `req.auth.userId`.
6. Avoid logging the token.

Example request context:

```ts
export interface AuthenticatedUser {
  id: string;
  email?: string;
  sessionId?: string;
}
```

Authorization rules:

- A user can access only their own journals.
- A user can access only analyses linked to their journals.
- A user can update only their own profile.
- A user can manage only their own trusted contacts.
- A user can read only their own notifications.
- The backend must ignore any body `user_id` field.

---

# 23. Standard Backend Response Format

Success response:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "uuid"
  }
}
```

Error response:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "details": {}
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

Do not expose:

- Stack traces.
- Supabase internal error payloads.
- FastAPI internal error payloads.
- Model prompt content.
- Journal text.
- Secret keys.

---

# 24. FastAPI AI Service Target Structure

```text
ai-service/
├── README.md
├── pyproject.toml
├── uv.lock
├── Dockerfile
├── .env.example
│
├── app/
│   ├── main.py
│   │
│   ├── api/
│   │   ├── dependencies.py
│   │   ├── middleware.py
│   │   └── routes/
│   │       ├── health.py
│   │       ├── readiness.py
│   │       ├── analysis.py
│   │       └── model_info.py
│   │
│   ├── core/
│   │   ├── config.py
│   │   ├── logging.py
│   │   ├── security.py
│   │   ├── exceptions.py
│   │   └── lifespan.py
│   │
│   ├── schemas/
│   │   ├── analysis_request.py
│   │   ├── analysis_response.py
│   │   ├── health_response.py
│   │   ├── readiness_response.py
│   │   └── model_info_response.py
│   │
│   ├── model/
│   │   ├── loader.py
│   │   ├── registry.py
│   │   ├── runtime.py
│   │   ├── metadata.py
│   │   └── device.py
│   │
│   ├── preprocessing/
│   │   ├── cleaner.py
│   │   ├── tokenizer.py
│   │   ├── chunker.py
│   │   ├── prompt_builder.py
│   │   └── input_limits.py
│   │
│   ├── inference/
│   │   ├── engine.py
│   │   ├── generation.py
│   │   ├── parser.py
│   │   ├── aggregation.py
│   │   ├── postprocessing.py
│   │   └── severity.py
│   │
│   ├── safety/
│   │   ├── urgent_language.py
│   │   ├── crisis_rules.py
│   │   ├── output_guard.py
│   │   └── redaction.py
│   │
│   ├── monitoring/
│   │   ├── metrics.py
│   │   ├── latency.py
│   │   ├── model_monitor.py
│   │   └── resource_usage.py
│   │
│   └── utils/
│       ├── identifiers.py
│       ├── hashing.py
│       ├── timing.py
│       └── json.py
│
├── model-artifacts/
│   ├── README.md
│   └── .gitkeep
│
├── scripts/
│   ├── download_model.py
│   ├── verify_model.py
│   ├── benchmark.py
│   ├── smoke_test.py
│   └── print_model_info.py
│
└── tests/
    ├── unit/
    ├── integration/
    ├── contract/
    ├── safety/
    └── fixtures/
```

---

# 25. AI Service Responsibilities

The AI service must:

- Load the base model.
- Load the LoRA adapter.
- Load the tokenizer.
- Configure deterministic inference.
- Clean journal text.
- Enforce input limits.
- Chunk long text.
- Build the prompt.
- Run inference.
- Parse strict JSON.
- Validate score boundaries.
- Aggregate window predictions.
- Map score to severity.
- Detect urgent language separately.
- Return model version.
- Return processing time.
- Return request ID.
- Expose readiness state.
- Avoid storing journal content.

The AI service must not:

- Create users.
- Check frontend permissions.
- Manage Supabase Auth.
- Store journal entries.
- Store analysis history directly.
- Send notifications directly unless explicitly designed as an internal extension.
- Return raw generated text to the browser.

---

# 26. AI Service Endpoints

## 26.1 Health

```text
GET /health
```

Purpose:

- Confirm the process is running.
- Does not guarantee the model is loaded.

Response:

```json
{
  "status": "ok"
}
```

## 26.2 Readiness

```text
GET /ready
```

Purpose:

- Confirm the model, tokenizer, and adapter are loaded.
- Confirm the service is ready for inference.

Response:

```json
{
  "status": "ready",
  "model_loaded": true,
  "device": "cuda"
}
```

## 26.3 Model info

```text
GET /v1/model
```

Response:

```json
{
  "model_name": "microsoft/Phi-4-mini-instruct",
  "adapter_version": "echo-v1",
  "model_version": "phi4-mini-echo-v1",
  "device": "cuda",
  "max_input_tokens": 384
}
```

## 26.4 Analyze

```text
POST /v1/analyze
```

Request:

```json
{
  "request_id": "7b8c2249-5338-48e1-9089-d61fe81a5dd6",
  "journal_text": "I have felt tired and disconnected lately.",
  "language": "en"
}
```

Response:

```json
{
  "request_id": "7b8c2249-5338-48e1-9089-d61fe81a5dd6",
  "phq8_score": 10,
  "severity": "moderate",
  "urgent_language_detected": false,
  "model_version": "phi4-mini-echo-v1",
  "processing_time_ms": 1380
}
```

---

# 27. AI Output Validation

The Node.js backend must validate every AI response using Zod.

Example:

```ts
import { z } from "zod";

export const aiAnalysisResponseSchema = z.object({
  request_id: z.string().uuid(),
  phq8_score: z.number().int().min(0).max(24),
  severity: z.enum([
    "minimal",
    "mild",
    "moderate",
    "moderately_severe",
    "severe",
  ]),
  urgent_language_detected: z.boolean(),
  model_version: z.string().min(1),
  processing_time_ms: z.number().int().nonnegative(),
});
```

Reject the AI response if:

- The score is outside 0–24.
- The score is not an integer.
- The severity is invalid.
- The request ID does not match.
- The model version is missing.
- The body is not valid JSON.

---

# 28. Severity Mapping

Use this mapping:

```text
0–4   → minimal
5–9   → mild
10–14 → moderate
15–19 → moderately_severe
20–24 → severe
```

The model may return the score, but the service should still verify or derive the severity deterministically from the score.

The frontend must display:

```text
This result is an automated estimate and is not a clinical diagnosis.
```

---

# 29. Urgent-Language Detection

Urgent-language detection must be independent from the PHQ-8 score.

Reason:

- A user may express immediate danger even if the numeric score is low.
- A model score must not suppress crisis handling.
- Crisis detection should use explicit rules and a separate safety layer.

The AI response should include:

```json
{
  "urgent_language_detected": true
}
```

The Node.js backend should then return a safe UI directive such as:

```json
{
  "showCrisisSupport": true
}
```

The frontend should display emergency and crisis-support options without implying that the system has contacted anyone unless it actually has.

---

# 30. Node.js to FastAPI Client

Create:

```text
backend/src/infrastructure/ai/ai.client.ts
```

The client must:

- Read `AI_SERVICE_URL`.
- Add `Authorization: Bearer <AI_SERVICE_TOKEN>`.
- Add a request ID.
- Apply a timeout.
- Send JSON only.
- Validate the JSON response.
- Handle timeout errors.
- Handle connection errors.
- Handle invalid response errors.
- Avoid excessive automatic retries.
- Never log journal text.

Suggested retry behavior:

- No automatic retry for validation failures.
- Maximum one controlled retry for temporary connection failure.
- No retry if the request exceeded the application timeout and model state is unknown.
- Preserve idempotency using the analysis record and request ID.

---

# 31. Journal Analysis Workflow

The complete workflow should be:

```text
1. User writes a journal entry.
2. Frontend validates basic required fields.
3. Frontend sends the entry to Node.js.
4. Node.js validates the bearer token.
5. Node.js derives the user ID from the token.
6. Node.js validates the journal payload.
7. Node.js verifies required consent.
8. Node.js saves the journal.
9. Node.js creates a journal analysis record with status `pending`.
10. Node.js changes status to `processing`.
11. Node.js sends journal text to FastAPI.
12. FastAPI validates the internal token.
13. FastAPI preprocesses the journal.
14. FastAPI splits long text into windows if necessary.
15. FastAPI runs deterministic inference.
16. FastAPI validates and aggregates the result.
17. FastAPI runs independent urgent-language detection.
18. FastAPI returns strict JSON.
19. Node.js validates the AI response.
20. Node.js saves the analysis result.
21. Node.js changes status to `completed`.
22. Node.js returns a safe response to the frontend.
23. Frontend displays the result and non-diagnostic disclaimer.
```

Failure workflow:

```text
1. Journal remains saved.
2. Analysis status becomes `failed`.
3. A sanitized failure code is stored.
4. Internal stack traces are not exposed.
5. The user may retry through a controlled endpoint.
6. The retry must not create uncontrolled duplicate records.
```

Analysis statuses:

```text
pending
processing
completed
failed
```

---

# 32. Shared API Contracts

Create:

```text
packages/contracts/
├── package.json
├── README.md
├── src/
│   ├── journal.ts
│   ├── analysis.ts
│   ├── profile.ts
│   ├── consent.ts
│   ├── notification.ts
│   ├── api-error.ts
│   └── index.ts
│
├── schemas/
│   ├── journal.schema.json
│   ├── analysis-request.schema.json
│   ├── analysis-response.schema.json
│   ├── profile.schema.json
│   └── error-response.schema.json
│
└── openapi/
    ├── backend.openapi.yaml
    └── ai-service.openapi.yaml
```

The contract package should define:

- Request DTOs.
- Response DTOs.
- Error payloads.
- Analysis statuses.
- Severity labels.
- Shared IDs and timestamps.

Avoid importing frontend ViewModel types into the backend.

---

# 33. Supabase Target Structure

```text
supabase/
├── config.toml
├── seed.sql
├── README.md
│
├── migrations/
│   └── generated migration files
│
├── functions/
│   ├── export-user-data/
│   ├── delete-user-data/
│   └── send-notification/
│
└── tests/
    ├── profiles-rls.test.sql
    ├── journals-rls.test.sql
    ├── journal-analyses-rls.test.sql
    ├── mood-entries-rls.test.sql
    ├── trusted-contacts-rls.test.sql
    └── notifications-rls.test.sql
```

Create migrations using:

```bash
supabase migration new create_profiles
supabase migration new create_user_consents
supabase migration new create_journals
supabase migration new create_journal_analyses
supabase migration new create_mood_entries
supabase migration new create_trusted_contacts
supabase migration new create_notifications
supabase migration new create_model_versions
supabase migration new create_rls_policies
supabase migration new create_indexes
```

Do not invent timestamped filenames manually.

---

# 34. Recommended Database Tables

## 34.1 Profiles

```text
profiles
├── id UUID primary key references auth.users(id)
├── display_name TEXT
├── avatar_path TEXT
├── timezone TEXT
├── onboarding_completed BOOLEAN
├── created_at TIMESTAMPTZ
└── updated_at TIMESTAMPTZ
```

## 34.2 User consents

```text
user_consents
├── id UUID primary key
├── user_id UUID references auth.users(id)
├── consent_type TEXT
├── consent_version TEXT
├── accepted BOOLEAN
├── accepted_at TIMESTAMPTZ
├── revoked_at TIMESTAMPTZ nullable
└── created_at TIMESTAMPTZ
```

## 34.3 Journals

```text
journals
├── id UUID primary key
├── user_id UUID references auth.users(id)
├── title TEXT
├── content TEXT
├── entry_date DATE
├── analysis_status TEXT
├── created_at TIMESTAMPTZ
├── updated_at TIMESTAMPTZ
└── deleted_at TIMESTAMPTZ nullable
```

## 34.4 Journal analyses

```text
journal_analyses
├── id UUID primary key
├── journal_id UUID references journals(id)
├── user_id UUID references auth.users(id)
├── model_version_id UUID references model_versions(id)
├── phq8_score INTEGER
├── severity TEXT
├── urgent_language_detected BOOLEAN
├── processing_time_ms INTEGER
├── status TEXT
├── failure_code TEXT nullable
├── request_id UUID
├── analyzed_at TIMESTAMPTZ nullable
└── created_at TIMESTAMPTZ
```

Constraints:

- `phq8_score` between 0 and 24.
- `status` limited to pending, processing, completed, failed.
- `severity` limited to approved labels.

## 34.5 Mood entries

```text
mood_entries
├── id UUID primary key
├── user_id UUID references auth.users(id)
├── mood_score INTEGER
├── energy_score INTEGER
├── note TEXT nullable
├── recorded_at TIMESTAMPTZ
└── created_at TIMESTAMPTZ
```

## 34.6 Trusted contacts

```text
trusted_contacts
├── id UUID primary key
├── user_id UUID references auth.users(id)
├── contact_name TEXT
├── contact_email TEXT nullable
├── contact_phone TEXT nullable
├── relationship TEXT
├── verified BOOLEAN
├── created_at TIMESTAMPTZ
└── updated_at TIMESTAMPTZ
```

## 34.7 Notification preferences

```text
notification_preferences
├── id UUID primary key
├── user_id UUID unique references auth.users(id)
├── email_enabled BOOLEAN
├── push_enabled BOOLEAN
├── journal_reminders_enabled BOOLEAN
├── insight_notifications_enabled BOOLEAN
├── created_at TIMESTAMPTZ
└── updated_at TIMESTAMPTZ
```

## 34.8 Notifications

```text
notifications
├── id UUID primary key
├── user_id UUID references auth.users(id)
├── notification_type TEXT
├── title TEXT
├── message TEXT
├── read_at TIMESTAMPTZ nullable
└── created_at TIMESTAMPTZ
```

## 34.9 Audit events

```text
audit_events
├── id UUID primary key
├── user_id UUID nullable
├── event_type TEXT
├── resource_type TEXT
├── resource_id UUID nullable
├── request_id UUID
├── metadata JSONB
└── created_at TIMESTAMPTZ
```

Do not store raw journal text in audit metadata.

## 34.10 Model versions

```text
model_versions
├── id UUID primary key
├── model_name TEXT
├── base_model TEXT
├── adapter_version TEXT
├── adapter_checksum TEXT
├── configuration JSONB
├── active BOOLEAN
├── deployed_at TIMESTAMPTZ
└── retired_at TIMESTAMPTZ nullable
```

---

# 35. Supabase RLS Policies

Enable RLS on every exposed user-data table.

Example journals policy:

```sql
alter table public.journals enable row level security;

create policy "Users can read their own journals"
on public.journals
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own journals"
on public.journals
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own journals"
on public.journals
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own journals"
on public.journals
for delete
to authenticated
using ((select auth.uid()) = user_id);
```

Apply equivalent ownership policies to:

- Profiles.
- User consents.
- Journal analyses.
- Mood entries.
- Trusted contacts.
- Notification preferences.
- Notifications.

Audit events may require stricter server-only access.

Model versions should usually be read-only to application users or accessible only through the backend.

---

# 36. Database Indexes

Create indexes for:

```text
profiles.id
user_consents.user_id
user_consents.consent_type
journals.user_id
journals.entry_date
journals.analysis_status
journal_analyses.journal_id
journal_analyses.user_id
journal_analyses.status
journal_analyses.request_id
mood_entries.user_id
mood_entries.recorded_at
trusted_contacts.user_id
notifications.user_id
notifications.read_at
audit_events.user_id
audit_events.request_id
model_versions.active
```

Use unique indexes where appropriate:

- `notification_preferences.user_id`.
- Possibly one active model version if enforced by application logic or a partial unique index.

---

# 37. Database Testing Requirements

Create tests proving:

1. Anonymous users cannot read journals.
2. User A cannot read User B journals.
3. User A cannot update User B profile.
4. User A cannot delete User B journal.
5. User A cannot read User B analysis.
6. User A cannot manage User B trusted contacts.
7. Authenticated users can insert their own records.
8. Update policies reject reassignment of `user_id`.
9. Journal analysis scores outside 0–24 are rejected.
10. Invalid statuses are rejected.
11. Duplicate request IDs are handled according to the idempotency design.

---

# 38. Machine Learning Workspace

Keep training and production inference separate.

```text
ml/
├── README.md
├── training/
│   ├── configs/
│   ├── preprocessing/
│   ├── datasets/
│   ├── trainers/
│   ├── callbacks/
│   └── train.py
│
├── evaluation/
│   ├── metrics/
│   ├── stress-tests/
│   ├── safety-tests/
│   ├── evaluate.py
│   └── compare_models.py
│
├── experiments/
│   ├── configs/
│   └── reports/
│
├── datasets/
│   ├── raw/
│   │   └── .gitkeep
│   ├── processed/
│   │   └── .gitkeep
│   └── synthetic/
│
├── outputs/
│   └── .gitkeep
│
└── notebooks/
```

Rules:

- Do not import training scripts into FastAPI.
- Do not put production API code in notebooks.
- Do not commit DAIC-WOZ, E-DAIC, or other protected datasets.
- Do not commit model checkpoints or LoRA adapters.
- Production inference may reuse only stable preprocessing and schema logic that has been extracted into production-safe modules.

---

# 39. Environment Variables

## 39.1 Root `.env.example`

```env
NODE_ENV=development
```

## 39.2 Frontend `.env.example`

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

## 39.3 Backend `.env.example`

```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000

SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_TOKEN=
AI_REQUEST_TIMEOUT_MS=30000

LOG_LEVEL=info
REQUEST_BODY_LIMIT=1mb
```

## 39.4 AI service `.env.example`

```env
APP_ENV=development
HOST=0.0.0.0
PORT=8000

AI_SERVICE_TOKEN=
BASE_MODEL_ID=microsoft/Phi-4-mini-instruct
LORA_ADAPTER_PATH=/models/echo-adapter
MODEL_VERSION=phi4-mini-echo-v1

MAX_INPUT_TOKENS=384
MAX_NEW_TOKENS=64
DEVICE=cuda
TORCH_DTYPE=bfloat16

LOG_LEVEL=INFO
```

Rules:

- Validate required variables at startup.
- Fail fast when required variables are missing.
- Never commit real `.env` files.
- Never expose server-only variables using `NEXT_PUBLIC_`.

---

# 40. Docker Development Setup

Create:

```text
docker-compose.yml
```

Services:

```text
frontend
backend
ai-service
```

Recommended ports:

```text
frontend: 3000
backend: 4000
ai-service: 8000
```

The AI model must not be baked into the Docker image.

Use a mounted model directory:

```text
./local-models:/models:ro
```

The backend should wait for the AI service readiness endpoint before declaring full readiness.

The AI service should run with one worker by default.

---

# 41. Logging and Privacy

All services must use structured logs.

Recommended log fields:

```text
requestId
service
route
method
statusCode
durationMs
userIdHash
errorCode
```

Do not log:

- Journal text.
- Prompt content.
- Generated model text.
- Access tokens.
- Refresh tokens.
- Service-role keys.
- Internal AI service token.
- Full email addresses unless required.
- Trusted contact details.

Use redaction helpers for sensitive fields.

---

# 42. Rate Limiting

Apply rate limits separately.

General API:

- Moderate request limit per authenticated user and IP.

Authentication routes:

- Strict rate limit.

AI analysis route:

- Lower limit because inference is expensive.
- Limit by authenticated user.
- Prevent repeated analysis creation for the same journal while one is pending or processing.

Retry route:

- Allow only failed analyses.
- Add a cooldown.

---

# 43. Error Handling

Create error classes:

```text
AppError
ValidationError
AuthenticationError
AuthorizationError
NotFoundError
ConflictError
RateLimitError
ExternalServiceError
```

Each error should define:

- Safe message.
- Internal code.
- HTTP status.
- Optional details.
- Whether it should be logged as warning or error.

Example error codes:

```text
VALIDATION_ERROR
AUTHENTICATION_REQUIRED
INVALID_ACCESS_TOKEN
RESOURCE_FORBIDDEN
JOURNAL_NOT_FOUND
ANALYSIS_ALREADY_RUNNING
CONSENT_REQUIRED
AI_SERVICE_UNAVAILABLE
AI_RESPONSE_INVALID
RATE_LIMIT_EXCEEDED
INTERNAL_SERVER_ERROR
```

---

# 44. Testing Strategy

## 44.1 Frontend tests

Test:

- View rendering.
- Loading states.
- Error states.
- Empty states.
- ViewModel form validation.
- ViewModel success flow.
- ViewModel API failure flow.
- Route registry correctness.
- Protected layout behavior.
- Accessibility of forms and dialogs.

## 44.2 Backend unit tests

Test:

- Validators.
- Services.
- Mappers.
- Error normalization.
- Ownership logic.
- Consent checks.
- AI response validation.

## 44.3 Backend integration tests

Test:

- Authentication middleware.
- Journal CRUD.
- Analysis creation.
- Analysis retry.
- Unauthorized resource access.
- Invalid request payloads.
- AI timeout handling.
- AI invalid-response handling.

## 44.4 AI service unit tests

Test:

- Input validation.
- Score range validation.
- Severity mapping.
- JSON parsing.
- Window aggregation.
- Urgent-language detection.
- Output guard.

## 44.5 AI service integration tests

Test:

- Health endpoint.
- Readiness before and after model load.
- Internal token validation.
- Analyze endpoint.
- Deterministic repeated inference.
- Model metadata endpoint.

## 44.6 Contract tests

Test that:

- FastAPI response matches Node.js Zod schema.
- Node.js response matches frontend contract.
- Shared status and severity enums match across services.

---

# 45. Documentation Structure

Create:

```text
docs/
├── architecture/
│   ├── system-overview.md
│   ├── frontend-mvvm.md
│   ├── backend-architecture.md
│   ├── ai-inference-architecture.md
│   ├── database-architecture.md
│   ├── request-flow.md
│   └── deployment-architecture.md
│
├── api/
│   ├── backend-api.md
│   ├── ai-service-api.md
│   └── error-codes.md
│
├── security/
│   ├── authentication.md
│   ├── authorization.md
│   ├── data-privacy.md
│   ├── logging-redaction.md
│   └── threat-model.md
│
├── model/
│   ├── model-card.md
│   ├── limitations.md
│   ├── evaluation-summary.md
│   └── deployment-requirements.md
│
└── refactoring/
    ├── current-codebase-audit.md
    ├── file-move-map.md
    ├── migration-plan.md
    ├── migration-risks.md
    └── migration-report.md
```

---

# 46. Naming Conventions

## Frontend components

```text
PascalCase.tsx
```

Examples:

```text
JournalCreateView.tsx
JournalEditor.tsx
CrisisBanner.tsx
```

## ViewModels and hooks

```text
camelCase with use prefix
```

Examples:

```text
useJournalCreateViewModel.ts
useDashboardViewModel.ts
```

## Frontend feature folders

```text
lowercase or kebab-case
```

Examples:

```text
journal
trusted-contacts
crisis-support
```

## Backend files

```text
feature.responsibility.ts
```

Examples:

```text
journals.routes.ts
journals.controller.ts
journals.service.ts
journals.repository.ts
journals.validator.ts
```

## Python files

```text
snake_case.py
```

Examples:

```text
prompt_builder.py
urgent_language.py
analysis_response.py
```

## Assets

```text
lowercase-kebab-case
```

Examples:

```text
landing-hero-background.png
journal-empty-state.svg
```

---

# 47. Root Scripts

The root `package.json` should provide workspace commands.

Suggested scripts:

```json
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "test": "turbo run test",
    "dev:frontend": "npm --workspace frontend run dev",
    "dev:backend": "npm --workspace backend run dev",
    "test:frontend": "npm --workspace frontend run test",
    "test:backend": "npm --workspace backend run test"
  }
}
```

Do not add scripts blindly. Confirm the package manager and current scripts first.

---

# 48. Gitignore Requirements

Update `.gitignore`:

```gitignore
.env
.env.*
!.env.example

node_modules/
.next/
dist/
build/
coverage/

__pycache__/
.pytest_cache/
.mypy_cache/
.ruff_cache/
.venv/
venv/

ml/datasets/raw/*
ml/datasets/processed/*
ml/outputs/*
ai-service/model-artifacts/*

!ml/datasets/raw/.gitkeep
!ml/datasets/processed/.gitkeep
!ml/outputs/.gitkeep
!ai-service/model-artifacts/.gitkeep

*.safetensors
*.pt
*.pth
*.ckpt
*.bin

logs/
work/
tmp/
.DS_Store
Thumbs.db
```

Never commit:

- User journals.
- Dataset transcripts.
- Model checkpoints.
- LoRA adapter weights.
- Access tokens.
- Supabase service-role keys.
- AI internal service tokens.
- Private evaluation outputs.

---

# 49. Detailed Refactoring Phases

# Phase 0 — Safety Preparation

## Tasks

1. Create a new Git branch:

```text
refactor/clean-mvvm-node-fastapi-supabase
```

2. Record current Git status.
3. Commit or stash unrelated changes.
4. Record current build results.
5. Record current test results.
6. Create a backup tag or checkpoint branch.
7. Do not run destructive cleanup before the audit.

## Deliverables

- Clean refactor branch.
- Pre-refactor status report.
- Existing build and test baseline.

## Acceptance criteria

- Existing work is recoverable.
- No unrelated uncommitted changes are lost.

---

# Phase 1 — Full Codebase Audit

## Tasks

1. Scan the entire root directory.
2. List all frontend routes.
3. List all feature folders.
4. List all page files.
5. Find direct `fetch` calls.
6. Find direct Supabase calls.
7. Find auth client creation.
8. Find duplicate clients.
9. Find components over an agreed size threshold.
10. Find deep relative imports.
11. Find unused or duplicate files.
12. Document assets and generated folders.
13. Document current environment variables.
14. Document current tests.

## Deliverables

```text
docs/refactoring/current-codebase-audit.md
docs/refactoring/file-move-map.md
docs/refactoring/migration-risks.md
```

## Acceptance criteria

- Every route is documented.
- Every major feature has a destination.
- No file is scheduled for deletion without a usage check.

---

# Phase 2 — Establish Root Workspace

## Tasks

1. Create root folders:

```text
backend/
ai-service/
supabase/
ml/
packages/
docs/
scripts/
assets/
```

2. Keep the existing frontend functional.
3. Add root `.gitignore`.
4. Add root `.env.example`.
5. Add root `README.md` outline.
6. Add root workspace configuration only after confirming package manager compatibility.
7. Add root development scripts.

## Acceptance criteria

- Frontend still installs and builds.
- No route changes.
- Workspace commands are documented.

---

# Phase 3 — Frontend Asset Cleanup

## Tasks

1. Move runtime assets into `frontend/public/`.
2. Move design references into `assets/design/`.
3. Rename files to lowercase kebab-case.
4. Correct misspelled filenames.
5. Update references in JSX, CSS, and configuration.
6. Move generated outputs to `ml/outputs/` if needed.
7. Move temporary work to `work/`.
8. Remove empty folders only after verifying no tooling depends on them.

## Acceptance criteria

- Every image loads correctly.
- No broken paths.
- Frontend build passes.
- No runtime asset remains under the old root `assets/` directory.

---

# Phase 4 — Frontend Shared Foundation

## Tasks

1. Create `shared-components/`.
2. Consolidate duplicate buttons, cards, inputs, modals, and loading states.
3. Create route registry.
4. Add path aliases.
5. Add shared API client.
6. Add Supabase browser/server clients.
7. Add providers.
8. Add standardized frontend errors.
9. Add route documentation.

## Acceptance criteria

- Shared components do not import feature code.
- No new circular dependencies.
- Type checking passes.
- Route registry is used instead of hard-coded repeated paths where practical.

---

# Phase 5 — Frontend MVVM Migration

Migrate one feature at a time.

Recommended order:

1. Public content.
2. Landing.
3. Authentication.
4. Onboarding.
5. Dashboard.
6. Journal.
7. Insights.
8. Buddy.
9. Grounding.
10. Settings.
11. Crisis support.

For each feature:

1. Identify current page and components.
2. Create feature folder.
3. Move UI into `view/`.
4. Move state into `viewmodel/`.
5. Move types and schemas into `model/`.
6. Move API calls into `services/`.
7. Move feature-only components into `components/`.
8. Export public items through `index.ts`.
9. Replace the page body with the feature View.
10. Run tests and build.
11. Remove old files only after import verification.

## Acceptance criteria per feature

- Existing route works.
- Existing design is preserved.
- `page.tsx` is thin.
- View does not call backend directly.
- ViewModel contains no JSX.
- Model contains no React code.
- Tests pass.

---

# Phase 6 — Backend Skeleton

## Tasks

1. Create Express TypeScript project.
2. Add environment validation.
3. Add app and server separation.
4. Add CORS.
5. Add Helmet.
6. Add JSON limits.
7. Add request IDs.
8. Add structured logging.
9. Add error classes.
10. Add centralized error middleware.
11. Add not-found middleware.
12. Add health endpoint.
13. Add test setup.

## Acceptance criteria

- `GET /api/v1/health` returns success.
- Backend starts with valid environment variables.
- Backend fails fast on missing required variables.
- Tests pass.
- No feature logic is placed in `app.ts`.

---

# Phase 7 — Supabase Authentication Integration

## Tasks

1. Create Supabase admin client.
2. Create user-scoped client if needed.
3. Implement bearer-token middleware.
4. Add authenticated request typing.
5. Add auth tests.
6. Ensure tokens are not logged.
7. Ensure service-role key remains backend-only.

## Acceptance criteria

- Valid token returns authenticated user context.
- Invalid token returns 401.
- Missing token returns 401.
- No body-provided user ID is trusted.

---

# Phase 8 — Database Migrations and RLS

## Tasks

1. Initialize Supabase folder.
2. Create migrations through CLI.
3. Create required tables.
4. Add constraints.
5. Add indexes.
6. Enable RLS.
7. Add ownership policies.
8. Add tests.
9. Generate database types.
10. Run database advisors if available.

## Acceptance criteria

- Migrations apply cleanly.
- RLS tests pass.
- User A cannot access User B data.
- Backend types match database schema.

---

# Phase 9 — Backend Profiles and Journals

## Tasks

1. Implement profile routes, controller, service, repository, validator, and model.
2. Implement journal CRUD.
3. Add ownership checks.
4. Add pagination.
5. Add soft-delete behavior if required.
6. Add integration tests.
7. Connect frontend journal service to Node.js.
8. Remove direct frontend journal database calls.

## Acceptance criteria

- Journal CRUD works through Node.js.
- Frontend no longer queries journals directly.
- Ownership tests pass.
- RLS remains active.

---

# Phase 10 — AI Service Skeleton

## Tasks

1. Create FastAPI project.
2. Add configuration validation.
3. Add internal token authentication.
4. Add health endpoint.
5. Add readiness endpoint.
6. Add model-info endpoint.
7. Add placeholder analysis endpoint.
8. Add logging redaction.
9. Add tests.

## Acceptance criteria

- Health works without model inference.
- Readiness is false before model load.
- Analyze rejects missing or invalid internal token.
- Tests pass.

---

# Phase 11 — Fine-Tuned Model Integration

## Tasks

1. Extract the production model loader from existing inference code.
2. Load base model.
3. Load LoRA adapter.
4. Load tokenizer.
5. Configure device and dtype.
6. Configure deterministic inference.
7. Add preprocessing.
8. Add chunking.
9. Add strict JSON parser.
10. Add median or frozen aggregation strategy from the validated model pipeline.
11. Add score validation.
12. Add severity mapping.
13. Add urgent-language detection.
14. Add model metadata.
15. Add benchmark script.
16. Add model verification script.

## Acceptance criteria

- Model loads once.
- Repeated same input produces deterministic output.
- Output is valid JSON.
- PHQ-8 score stays in 0–24.
- GPU usage fits the deployment limit.
- One-worker configuration is documented.

---

# Phase 12 — Node.js and FastAPI Integration

## Tasks

1. Create typed AI client.
2. Add internal service token.
3. Add timeout.
4. Add request IDs.
5. Add response validation.
6. Add failure mapping.
7. Add AI health check.
8. Add contract tests.

## Acceptance criteria

- Node.js can call FastAPI.
- Invalid FastAPI response is rejected.
- Timeout becomes a safe backend error.
- Journal text is not logged.

---

# Phase 13 — Analysis Workflow

## Tasks

1. Create analysis repository.
2. Create analysis service.
3. Add pending record creation.
4. Add processing transition.
5. Call AI service.
6. Persist completed result.
7. Persist failed status on error.
8. Add retry endpoint.
9. Prevent duplicate active analysis.
10. Add audit event.
11. Connect frontend analysis service.
12. Display analysis status and results.

## Acceptance criteria

- End-to-end journal analysis succeeds.
- Failure state is recoverable.
- Duplicate requests are controlled.
- Result includes model version.
- Frontend displays disclaimer.

---

# Phase 14 — Remaining Features

Implement through the backend as required:

- Mood entries.
- Consent.
- Trusted contacts.
- Notification preferences.
- Notifications.
- Export.
- Account deletion.
- Dashboard summaries.
- Insight summaries.
- Audit events.

## Acceptance criteria

- Frontend services use Node.js.
- RLS remains active.
- Each feature has tests.

---

# Phase 15 — Security Review

## Tasks

1. Search for exposed secrets.
2. Search for direct FastAPI URLs in frontend.
3. Search for service-role usage in frontend.
4. Search for journal logging.
5. Review RLS.
6. Review ownership checks.
7. Review CORS.
8. Review rate limits.
9. Review error payloads.
10. Review upload restrictions if storage is used.
11. Review consent enforcement.
12. Review crisis-support wording.

## Acceptance criteria

- No critical secret exposure.
- No direct frontend-to-AI calls.
- No cross-user data access.
- No raw journal content in logs.

---

# Phase 16 — CI and Verification

Create workflows:

```text
.github/workflows/frontend-ci.yml
.github/workflows/backend-ci.yml
.github/workflows/ai-service-ci.yml
.github/workflows/security-checks.yml
```

Checks:

Frontend:

```text
install
lint
type-check
test
build
```

Backend:

```text
install
lint
type-check
test
build
```

AI service:

```text
uv sync
ruff
mypy
pytest
```

Security:

- Secret scanning.
- Dependency audit.
- No committed model artifacts.
- No committed datasets.

---

# Phase 17 — Documentation and Final Report

Create:

```text
docs/refactoring/migration-report.md
```

Include:

1. Final repository tree.
2. Files created.
3. Files moved.
4. Files renamed.
5. Files deleted.
6. Routes preserved.
7. Architectural decisions.
8. Build results.
9. Test results.
10. Database migration results.
11. RLS test results.
12. Known limitations.
13. Required manual configuration.
14. Model artifact placement.
15. Deployment notes.

---

# 50. File Move Map Template

Create a detailed mapping table:

| Current File | Target File | Change Type | Reason | Verified |
|---|---|---|---|---|
| `frontend/src/app/(protected)/journal/new/page.tsx` | Same route file, reduced content | Refactor | Thin page | No |
| Existing journal UI block | `frontend/src/features/journal/view/JournalCreateView.tsx` | Move | View separation | No |
| Existing journal state logic | `frontend/src/features/journal/viewmodel/useJournalCreateViewModel.ts` | Move | ViewModel separation | No |
| Existing journal types | `frontend/src/features/journal/model/journal.model.ts` | Move | Domain model | No |
| Existing API call | `frontend/src/features/journal/services/journal.service.ts` | Move | API isolation | No |

Continue for every migrated file.

---

# 51. Refactoring Risk Register

## Risk 1: Broken imports

Mitigation:

- Add path aliases first.
- Move one feature at a time.
- Run type checking after each move.

## Risk 2: Broken Next.js routes

Mitigation:

- Keep route folders unchanged.
- Make only the contents of `page.tsx` thin.
- Test every route after migration.

## Risk 3: Lost styles

Mitigation:

- Preserve class names and CSS imports during UI moves.
- Move style changes separately from architecture changes.

## Risk 4: Duplicate Supabase clients

Mitigation:

- Audit all client creation.
- Centralize browser and server clients.
- Delete duplicates only after import migration.

## Risk 5: Frontend auth regression

Mitigation:

- Migrate authentication after public pages.
- Preserve OAuth callback route.
- Test login, refresh, protected route, and logout.

## Risk 6: Cross-user data exposure

Mitigation:

- Use backend ownership checks.
- Use RLS.
- Add negative tests.

## Risk 7: GPU out-of-memory

Mitigation:

- One AI worker.
- Load model once.
- Keep tested sequence length.
- Add benchmark and memory verification.

## Risk 8: Invalid model output

Mitigation:

- Strict JSON parser.
- Pydantic validation.
- Node.js Zod validation.
- Safe failure state.

## Risk 9: Sensitive logs

Mitigation:

- Structured logging.
- Explicit redaction.
- No journal or prompt logging.
- Tests for log payloads where practical.

## Risk 10: Uncontrolled analysis duplication

Mitigation:

- Analysis statuses.
- Idempotent request ID.
- Reject second active analysis for the same journal.

---

# 52. Definition of Done

The refactor is complete only when all of the following are true:

## Repository

- Root structure is organized.
- Temporary and generated files are removed or relocated.
- Gitignore protects sensitive and large files.

## Frontend

- Every route still works.
- Pages are thin.
- Features use MVVM.
- Views contain no API calls.
- ViewModels contain no JSX.
- Models contain no React code.
- Shared components are feature-independent.
- Build, lint, type-check, and tests pass.

## Backend

- Express app is separated from server startup.
- Authentication works.
- Ownership checks work.
- Validation is centralized.
- Errors are standardized.
- Journals are managed through Node.js.
- Backend build and tests pass.

## AI service

- Model loads once.
- Health and readiness endpoints work.
- Internal authentication works.
- Output is deterministic and valid.
- Score stays within 0–24.
- Model version is returned.
- Tests pass.

## Supabase

- Migrations apply cleanly.
- RLS is enabled.
- Cross-user access tests fail as expected.
- Indexes are created.
- Database types are generated.

## Security

- No service-role key in frontend.
- No direct frontend-to-FastAPI calls.
- No raw journal content in logs.
- No private model or dataset artifacts in Git.

## Documentation

- Architecture docs exist.
- Route docs exist.
- API docs exist.
- Security docs exist.
- Migration report exists.

---

# 53. Final Recommended Request Flow

```text
Next.js Route
    ↓
Feature View
    ↓
Feature ViewModel
    ↓
Frontend Feature Service
    ↓
Shared API Client
    ↓
Node.js Route
    ↓
Authentication Middleware
    ↓
Validation Middleware
    ↓
Controller
    ↓
Service
    ├── Repository → Supabase PostgreSQL
    └── AI Client → FastAPI
                         ↓
                   Preprocessing
                         ↓
                   Fine-Tuned LLM
                         ↓
                   Output Validation
                         ↓
                   Safety Detection
                         ↓
                   Structured Response
```

---

# 54. Recommended Final Architecture Statement

```text
The Next.js application is the presentation layer.
The Node.js Express API is the application and authorization layer.
The FastAPI service is the model inference layer.
Supabase is the authentication and persistent data layer.
The fine-tuned LLM is never called directly from the browser.
```

---

# 55. Coding Agent Execution Instruction

Use the following instruction when assigning this plan to Codex or another coding agent:

```text
Execute the refactor incrementally. Begin with the full codebase audit, route inventory, file-move map, and risk assessment. Do not rewrite the application from scratch. Preserve working routes, styles, authentication, and user behavior. Migrate one feature at a time into MVVM, run validation after every phase, and do not delete old files until all imports, routes, tests, and assets have been verified. The frontend must call only the Node.js API for protected application operations. The Node.js API must validate Supabase authentication and ownership before calling the FastAPI AI service. The FastAPI service must load the fine-tuned model once and return strictly validated structured output. Supabase RLS must protect every user-owned table. Do not mark the work complete while builds, tests, migrations, or RLS checks fail.
```
