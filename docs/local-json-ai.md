# Local AI with JSON storage

From `E:\Python Project\CODEX\Echo`, stop the current launcher with Ctrl+C, then run:

```powershell
.\scripts\start-local-core.ps1 -EnableBuddy -LocalJson
```

Supabase remains responsible for login, account settings, consent/access checks, and existing journal source records. All new AI inference runs in local model workers. AI results, AI job state, Buddy conversations, and speech delivery metadata use account-scoped JSON files under `E:\Python Project\CODEX\Echo\local-data`. These files are readable local data and are ignored by Git. Microphone PCM is not stored. History-off Buddy conversations remain temporary.

This profile disables the hosted AI worker and skips hosted AI claim RPCs and native-runtime account-scope setup. Existing hosted AI results and chats are neither imported nor deleted; switching profiles changes the visible history store. No model or external inference fallback is introduced. Keep a single backend writer; do not delete its writer lock while the backend is running.

Authentication and account access still require Supabase connectivity; this is not a fully offline account system. Existing safety/consent checks remain active. Model readiness or inference failures remain errors.
