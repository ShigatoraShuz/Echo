# Model integration quickstart

Follow [Lloyd review and setup](docs/setup/LLOYD_REVIEW.md) for the current native text and final-v4 face integration. Use [integrated startup instructions](docs/setup/INTEGRATED_MODELS.md) for the account-scoped hosted development profile.

`npm run dev` starts models, backend and frontend after the private credentials, model bundles and development account scope are configured. Do not start a second instance on occupied ports.

The older `start-local-core.ps1` script is retained for the separate local Supabase database profile; hosted Supabase requires no Docker Desktop.
