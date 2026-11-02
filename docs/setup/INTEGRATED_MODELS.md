# Run Echo with native text models

From `C:\1Thesis\Echo-integration-20261030-175618`:

```powershell
npm run dev
```

Open http://127.0.0.1:3000 and use the existing Supabase account. This command starts the native AI service on loopback port 8002, backend on 4200 and frontend on 3000. Hosted Supabase stays the configured remote database/auth service; Docker Desktop is not required for this profile. Run one development terminal. Ctrl+C stops only its owned services.

The launcher requires the installed model manifest and `ai-service/.venv-core/Scripts/python.exe`. It preserves backend/.env encryption and authentication settings. It builds shared contracts, checks ports, verifies the scoped database functions, waits for AI readiness, then starts the app. Text model weights load on first use and stay in a bounded memory cache for subsequent inference. The fixed XLM-R, E4-C and CBT model set can remain resident together when the GPU memory budget permits; the loader evicts under pressure and retains free headroom. Concurrent journal/Buddy requests wait in a bounded queue behind the single GPU owner. Restart the development terminal after Python model-service code changes; frontend hot reload alone does not update that process.

Private development scope lives in ignored `backend/.local-development/native-runtime.json`:

```json
{
  "projectRef": "YOUR_EXISTING_SUPABASE_PROJECT_REF",
  "userIds": ["YOUR_DEVELOPMENT_ACCOUNT_UUID"],
  "createdAfter": "YOUR_ACTIVATION_TIME_IN_ISO_UTC"
}
```

Set actual project/account/time values before first use. The launcher generates dedicated loopback service tokens in that ignored file. Do not commit it or replace existing encryption keys. The current computer is already configured for the supplied test account. Add only intended development accounts (maximum 20); keep the activation time stable across restarts so interrupted eligible jobs can recover.

The additive migration `supabase/migrations/20261101070000_scoped_native_model_worker.sql` must exist in the configured project. It is already applied to the current hosted Echo project. Startup checks availability but never applies database migrations automatically. Only service_role can invoke its claim/recovery functions. Worker claims include the allowed accounts and activation time; existing old or other-account work stays untouched. Normal verification, policy consent, trusted contact, privacy preference, lease and encryption checks still apply.

Save a new reflection with analysis enabled. The progress dialog links to the saved full result. Journal, dashboard and insights read persisted results. The normal dashboard/insights adapters use authenticated HTTP and exclude simulated results. Development previews are off unless explicitly enabled separately.

Verified native capabilities: XLM-R safety/category classification, E4-C emotion analysis, and SeaLLMs Buddy generation. PHQ-8 experimental estimates are enabled using the installed adapter with a nullable base-model consistency pass. Only agreeing numeric criteria are retained; unknown/disagreeing values remain null and only eight numeric criteria produce a model total. This is not independent clinical validation or questionnaire scoring. Voice, facial analysis and realtime Talk are not enabled by this text profile. Installed files alone do not establish that those capabilities work through the app.

For the ordinary app without native models, explicitly set `ECHO_MODELS_ENABLED=false` before `npm run dev`. This does not substitute simulated inference. Existing `scripts/start-local-core.ps1` remains available for the separate local Supabase development stack and invokes the underlying app runner directly.


## Original Leo directory layout

The model root follows the original `model-integration` branch: `Echo` and `models` are siblings, for example `C:\1Thesis\Echo` and `C:\1Thesis\models`. For this integration checkout, the root is also `C:\1Thesis\models`. Model weights, manifest, adapter directories and final face bundle live there. `MODELS_ROOT` can explicitly override this location; the launcher resolves it before passing an absolute path to services.

The local installed Python environments remain explicitly configured per service. They do not require Leo's original E: drive path. No trained model files, vendor inference algorithms, prompts or UI components are changed by this path alignment. Backend model templates/schemas remain tracked in the repository; legacy installed-model paths may be compatibility junctions to the external root.
