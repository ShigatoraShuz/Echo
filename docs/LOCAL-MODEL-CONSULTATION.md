# Standard local Echo development

Root `npm run dev` currently starts only the frontend and Express backend through
`concurrently`, using their existing workspace configuration. It does not launch
FastAPI, validate checkpoints, or consume model selection state.

## Historical model-supervisor workflow

The supervisor, ports, readiness message and `dev:*` / `models:*` npm aliases below
belong to the retired integration, not current ordinary startup. Standalone model
tooling remains available separately; see the current entry point in
[model management](../backend/models/README.md). Retained instructions below are
historical and do not authorize starting that integration or changing data.

From C:\1Thesis\Echo, run **npm run dev**. Wait for `Echo development READY at http://127.0.0.1:3000`.

The existing supervisor verifies the local database and freshly validates selected checkpoints. FastAPI starts first; Express waits for its authenticated model registry; Next.js waits for Express. READY also requires a fresh Journal-worker heartbeat. Frontend hot reload and backend tsx watch remain enabled. Failed processes receive one delayed restart; unavailable inference remains a genuine error.

| Service | Address |
|---|---|
| Next.js | http://127.0.0.1:3000 |
| Express | http://127.0.0.1:4300 |
| Internal authenticated FastAPI | http://127.0.0.1:8100 |
| Journal worker | Inside Express, bounded and account scoped |
| Supabase Auth/API | http://127.0.0.1:54321 |
| PostgreSQL | 127.0.0.1:54322 |

## One-time prerequisites

Use the repository's installed Node dependencies, ai-service/.venv Python environment, installed checkpoints and initialized local Supabase database. Open Docker Desktop. This checkout uses desktop-linux and existing supabase_*_Echo containers labeled with this repository. Startup refuses another Docker host, checkout or database identity. It does not install software, download models, apply migrations, reset data or create accounts. If containers are stopped, start the existing stack through the established local Supabase workflow before npm run dev.

Private keys are stored in Git-ignored backend/.local-development/private.json, bound to the local PostgreSQL fingerprint. The first run on this existing database adopted the original local encryption/sign-up keys once, preserving saved data. Subsequent startup does not read fixture state/password files. Securely back up these private settings with your local database. An existing database without its original keys is refused rather than assigned replacement keys.

Existing authorized fictional students are adopted once from trusted Auth application metadata. A developer can explicitly enroll another fictional local account after its normal signup/onboarding:

```powershell
npm run dev:authorize -- --user YOUR_LOCAL_ACCOUNT_UUID --fictional
```

This changes only the private local allowlist. It does not change Auth roles, metadata, verification, consent or database records. Restart the app after enrollment. Never enroll a participant or a shared-cloud identity. Normal verified AI eligibility, current consent, ownership and the analysis quota remain required. Fixtures are optional test automation, not everyday runtime configuration.

## Start and stop

```powershell
npm run dev:check
npm run dev
# In a second terminal:
npm run models:status
npm run dev:stop
```

Ctrl+C also coordinates shutdown. The stop command sends a filesystem request to the owning supervisor; it does not kill an arbitrary PID. Docker and data remain intact. Occupied application ports are refused, without killing another application or choosing 3100. Bounded private logs and status are in backend/tmp/development-runtime/.

Model selection comes from backend/models/.local/active.json. Legacy selections are adopted once when this file is absent. A conflicting shell ECHO_ACTIVE_MODELS value is refused. No manual .env changes or consultation flags are required. dev:consultation and dev:consultation:check now alias standard startup.

The local profile leaves external email/push providers, the Professional event drain and unrelated retention/maintenance jobs disabled. It does not consume shared queues. Provider-dependent delivery requires separately configured local services. Application HTTP workflows remain available.

Qwen generation is provisional CPU inference. XLM-R remains raw uncalibrated research logits. E4 full classification and AI PHQ-8 remain unavailable; genuine self-reported PHQ-8 is separate. Missing models never become synthetic successes. See [model management](../backend/models/README.md).
