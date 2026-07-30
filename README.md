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

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development
npm run dev
```

## Project Structure

- `frontend/` — Next.js application
- `backend/` — Express API server
- `supabase/` — Database migrations and seed data
- `docs/` — API documentation and architecture guides

## License

MIT
