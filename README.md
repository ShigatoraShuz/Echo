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

For the local model branch, start with the [simple model integration workflow and requirements](docs/model-integration-quickstart.md).

```bash
# Install dependencies
npm install

# Copy environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Start development
npm run check:contracts
npm run dev
```

## Project Structure

For offline XLM-R, E4 emotion analysis, and CBT Buddy generation, see
[Local core models](docs/local-core-models.md). Models live in the sibling
`CODEX/models` folder and are not committed to this repository.

- `frontend/` — Next.js application
- `backend/` — Express API server
- `supabase/` — Database migrations and seed data
- `docs/` — API documentation and architecture guides

## License

MIT

## Local JSON analysis and Buddy

The core launcher defaults to local JSON storage. See [startup, data controls and limits](docs/local-json-storage.md).

## Journal PHQ-8 estimates

Journal analysis now supports nullable experimental SeaLLMs estimates in local JSON, separately from the PHQ-8 questionnaire. See [startup, scoring rules and verification](docs/journal-phq8-integration.md). MOSS work is currently deferred.
