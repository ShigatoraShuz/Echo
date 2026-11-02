# Echo — Mental Wellness Companion

A full-stack mental wellness application with AI-powered journaling, mood tracking, grounding exercises, and a supportive AI buddy.

## Features

- **Journal**: Rich editor with emotion tagging, search, filters, and autosave
- **Insights**: Emotion trends, risk signals, facial camera widget, and breakdown charts
- **Buddy**: Conversational AI companion with mood-aware responses
- **Grounding**: Breathing exercises (Box Breathing, Sensory, 5-4-3-2-1)
- **Settings**: Profile, notifications, privacy controls, trusted contacts
- **Onboarding**: Consent-based setup with profile and theme selection
- **Accessibility**: WCAG-compliant with screen reader support and keyboard navigation

## Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS, React
- **Backend**: Node.js, Express, Supabase, PostgreSQL
- **Testing**: Jest, React Testing Library, jest-axe
- **Documentation**: Storybook, OpenAPI/Swagger

## Quick Start

See [Lloyd review and setup](docs/setup/LLOYD_REVIEW.md) for the current integrated model profile, required private model bundles, database migrations and verification scope.

```powershell
npm ci
# Configure existing backend credentials, installed models and native development scope first.
npm run dev
```

One command starts Next.js (3000), Express (4200) and the authenticated local text-model service (8002). Hosted Supabase remains the configured remote auth/database service; Docker is not required for this profile. First-use model loads are lazy. Native inference is scoped to explicitly configured development accounts and retains ordinary account, verification and consent checks.

Saved real AI outputs populate journal, dashboard and insights. Final v4 facial analysis uses a live landmark-only mesh UI with the raw camera image hidden; automatic capture is controlled in Privacy settings; its journal-linked outputs are encrypted. PHQ-8 experimental estimates use conservative adapter/base agreement; unknown or disagreeing criteria stay null and only eight numeric criteria produce a model total; voice and realtime Talk are not enabled by this profile.

Model weights, camera data and credentials are not included in Git. Follow the review guide before running the app on another computer. These are local integration changes, not a production deployment.

## License

MIT
