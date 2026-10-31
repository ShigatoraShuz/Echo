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

Use the integrated standard application profile below. The retained native-model
guides describe research tooling; activation is currently blocked by the
[approved runtime safeguards](ai-service/README.md#approved-integration-containment-2026-10-31).

```bash
# Install dependencies
npm install

# Copy environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Start the normal frontend and Express backend
npm run check:contracts
npm run dev
```

Normal development uses the existing `frontend/.env*` and `backend/.env` configuration: Next.js on **3000** and Express on the configured `PORT` (currently **4200**). Email/password authentication and Supabase use those existing application settings. Google login is retired, as requested for this integration. Stop both owned workspace processes with **Ctrl+C**.

No Python service, Docker model stack, checkpoint selection or inference worker is required to start the app. Both research and native model implementations are preserved. Native service/worker activation and core-backed persistence fail closed pending privacy-safe transport and compatible environments; existing model files remain unused by normal startup. Buddy's pre-existing prewritten support remains available; it is not trained AI generation. Optional Journal analysis stays explicitly unavailable when `AI_ANALYSIS_MODE=disabled`.

`ECHO_HTTP_ONLY_MODE=1` suppresses background maintenance during development; it does **not** make shared-project requests read-only. Existing security auditing can still insert records, including for rejected authentication. Use isolated services for verification that must perform zero shared writes. The Professional event processor remains separately opt-in.

## Project Structure

For the retained XLM-R, E4 emotion, CBT and speech source, see
[AI service profiles and safeguards](ai-service/README.md). Original research model
paths and native core model paths differ; neither model assets nor private settings
are supplied by Git. Do not copy or replace model selections to start the standard app.

- `frontend/` — Next.js application
- `backend/` — Express API server
- `supabase/` — Database migrations and seed data
- `docs/` — API documentation and architecture guides

## License

MIT

## Local JSON analysis and Buddy

The retained core launcher requests local JSON storage, which is **blocked** in this
integration. Express rejects `AI_ANALYSIS_MODE=local_json` or any `AI_SERVICE_URL`.
Do not use that launcher for ordinary development. The [local storage design](docs/local-json-storage.md)
is retained for research context; new encrypted local persistence is deferred.

## Journal PHQ-8 estimates

Native nullable screening source and [research scoring documentation](docs/journal-phq8-integration.md)
are retained separately from the PHQ-8 questionnaire. Native activation remains
blocked; the standard profile must show unavailable analysis rather than invented
estimates. The questionnaire and encrypted historical results retain their existing contracts.


## Integrated development workspace

The canonical local candidate is `C:\1Thesis\Echo-integration-20261030-175618`, branch
`integration/main-model-local-20261030-175618`. The original `C:\1Thesis\Echo`
checkout and its uncommitted work are preserved separately; do not overwrite them.

This worktree intentionally contains no copied private `.env` files. Before running
`npm run dev`, configure the ignored workspace environment files using owner-approved
settings through your normal private channel. Existing encrypted data requires its
original encryption keys/version map and shared idempotency configuration; do not
generate replacement keys for it. Use `AI_ANALYSIS_MODE=disabled`, leave
`AI_SERVICE_URL` unset, and leave native model/worker flags disabled. No live service
is contacted by the build/unit verification. Starting the normal backend later can
perform database maintenance; this verification does not authorize shared-data changes.

Leo's full [model/environment handover](docs/MODEL-INTEGRATION-HANDOVER.md) and new Talk/face/speech source are retained. Its native launch/storage instructions are research context: this integration keeps native, worker and Talk activation blocked. Ordinary `npm run dev` uses `scripts/run-local-dev.mjs` to start only Next.js and Express, with occupied-port checks and process-local loopback proxy exclusions.
