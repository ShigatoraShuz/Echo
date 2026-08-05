# ECHO system overview

```text
Next.js frontend
  -> Node.js Express API
       -> Supabase Auth + PostgreSQL
       -> FastAPI AI inference service
            -> validated fine-tuned model artefacts
```

The frontend is the presentation layer. It owns rendering and feature ViewModels, while feature services call the versioned Express API for protected application data.

The Express API verifies the Supabase bearer token, derives the authenticated user ID, applies validation and ownership rules, then coordinates repositories and the internal AI service. It never trusts `user_id` values from browser payloads.

The FastAPI service is an internal-only model boundary. It loads a validated model once at startup, accepts a request ID, returns a strictly structured result, does not persist journal content, and must never be called directly by the browser.

Supabase provides authentication and persistent storage. Every user-owned table receives RLS policies in addition to backend ownership checks. The current frontend remains on mock adapters until a configured backend is available.
