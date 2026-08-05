# Data privacy and logging boundary

- Browser code may use Supabase only for authentication through the public URL and publishable key.
- Browser code never receives the Supabase service-role key or the internal AI token.
- The frontend calls the Express API for protected data; it never calls FastAPI directly.
- The backend derives user identity from a verified bearer token and ignores user IDs supplied in request bodies.
- Raw journal content, prompts, bearer tokens, refresh tokens, service-role keys, and trusted-contact details must not be logged.
- Audit-event metadata rejects direct `journal_text`, `content`, `body`, and `prompt` keys at the database layer; application code must still avoid putting sensitive text in other keys.
- The AI service does not persist journal text and must not return raw generation output to the browser.
