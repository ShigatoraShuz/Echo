# Incremental migration plan

## Completed in this increment

1. Recorded a frontend baseline and route/component audit.
2. Added root npm workspace metadata and security-oriented ignore rules.
3. Added shared contracts, service skeletons, Supabase migration scaffolding, and architecture documentation.
4. Added cookie-based Supabase authentication utilities and an OAuth callback route without changing the active mock-auth flow.
4. Preserved all existing frontend routes, styles, mock adapters, and active asset references.

## Next safe migrations

1. Install and configure a Supabase project, then apply and test the initial migrations locally.
2. Configure frontend Supabase authentication clients and OAuth callback once project credentials exist.
3. Implement backend profile and journal repositories against the generated database types.
4. Replace the journal HTTP placeholder adapter with contract-tested API calls.
5. Add the validated fine-tuned model artefact and deterministic inference implementation to the AI service.
6. Migrate remaining features one at a time, preserving their current routes and UI.

## Constraints

- Never move runtime assets without a reference and visual verification pass.
- Never call the FastAPI service from browser code.
- Never trust user IDs from requests or log journal content.
- Never enable model inference with a placeholder or unvalidated clinical scoring model.
