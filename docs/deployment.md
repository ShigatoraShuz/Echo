# Render deployment

ECHO's Next.js frontend and Express API are separate **Node web services**. Create both from the monorepo root. This guide prepares staging and production configuration; it does not deploy anything.

## API web service

- Root directory: repository root
- Runtime: Node 24 (`.nvmrc`)
- Build command: `npm ci && npm run build -w @echo/contracts && npm run build -w @echo/backend`
- Start command: `npm run start -w @echo/backend`
- Health check path: `/api/v1/health`

Set the required values from `backend/.env.example` in Render's environment settings. In production use `NODE_ENV=production`, `FRONTEND_URL=https://<frontend-host>`, and the Supabase URL, publishable key, server-only service-role key, encryption keys, and idempotency keys. Set `SIGNUP_DRAFT_SECRET` to a 32+ character secret. Do not copy `backend/.env` into the service. Render supplies `PORT`; the API listens on that port on all interfaces.

## Frontend web service

- Root directory: repository root
- Runtime: Node 24 (`.nvmrc`)
- Build command: `npm ci && npm run build -w @echo/contracts && npm run build -w frontend`
- Start command: `npm run start -w frontend`

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_BASE_URL=https://<api-host>/api/v1`, and `NEXT_PUBLIC_DATA_ADAPTER=http` **before building**. Add the feature flags and Google client ID from `frontend/.env.example` as needed. These `NEXT_PUBLIC_*` values are embedded in the browser build; after changing them, rebuild and redeploy the frontend. Never set the Supabase service-role key or encryption keys on the frontend.

The frontend start script binds to `0.0.0.0` and uses Render's `PORT`. A full Next.js app with server routes and dynamic protected pages requires a web service, not a static site.

## Daily in-app reminder worker

Apply both `20261017120000_in_app_reminder_delivery.sql` and `20261018120000_notification_quiet_hours_grants.sql` before enabling daily reminders. The second migration grants authenticated Settings requests permission to save quiet hours; without it, the save returns 503 even though the worker can read the new columns.

After applying both migrations, run a separate, continuously running backend worker. Build it with the backend, then start `npm run worker:in-app-reminders -w @echo/backend` with the same server-only Supabase configuration as the API. The web service alone does not create reminders. The worker checks every minute; the database inserts at most one journal and one grounding notice per user per local date, and catches up later on the same day after downtime unless that time falls inside the user's quiet hours. Settings requires the target reminder time to be outside the quiet window, including one that crosses midnight. Quiet hours suppress only these daily reminders; account and support updates can still appear. No journal text or contact details enter reminder messages. The existing notification retention and account-erasure paths also cover these notices.

Keep `NEXT_PUBLIC_ENABLE_IN_APP_REMINDERS=false` until the migration and worker are healthy. After checking an opted-in staging account across its local reminder time, set the flag to `true` and rebuild the frontend. If the worker stops, set the flag back to `false` and rebuild so Settings does not promise active delivery. This flag affects wording only; the worker enforces the saved opt-ins. Push and email still require separate delivery services.

For a disposable-account check, build the backend, confirm no other account has enabled daily reminders on the target project, then run `ECHO_LIVE_REMINDER_QA=1 npm run test:live:reminders -w @echo/backend` (PowerShell: `$env:ECHO_LIVE_REMINDER_QA='1'; npm.cmd run test:live:reminders -w @echo/backend; Remove-Item Env:ECHO_LIVE_REMINDER_QA`). The check creates an email-confirmed test account without sending mail, verifies daily delivery, deduplication, quiet hours and resume, and removes the account and notices in `finally`. Do not use it when other recipients are opted in: its worker calls use a controlled timestamp and would also process their due reminders.

**Linked-project status, 2026-10-18:** Both reminder migrations (`20261017120000` and `20261018120000`) were applied and recorded. A disposable account passed authenticated Settings save and inbox reads, due delivery, deduplication, quiet-hour suppression, and resumption; its account and notices were removed. A worker is running on the local development machine; this is not a durable hosted worker. Three earlier account-erasure and retention migrations remain pending (`20261014090000`, `20261014091000`, `20261014092000`). A normal `supabase db push --linked` will refuse that out-of-order history; review those migrations separately before using `--include-all`. Do not mark push, email, or lock-screen alerts active until their providers and payload policy are implemented and checked.

### Email and device alerts

The linked project also has `20261018130000_notification_channel_delivery.sql` and `20261018131000_push_endpoint_single_owner.sql` applied. They queue one content-free delivery record per opted-in channel when a new notice is created. The single-owner endpoint index prevents one browser subscription from receiving alerts for two accounts. New subscriptions are encrypted with the backend content key; never put that key or a VAPID private key in the frontend. Account deletion removes queued records and subscriptions. The same worker command above handles in-app reminders, email, and web push; it claims batches with leases, retries transient failures up to five times, and cancels pending work after opt-out. Resend requests carry an idempotency key. SMTP message IDs are stable, but an SMTP retry after an uncertain acknowledgement may deliver twice.

For email, configure either `EMAIL_PROVIDER=resend` with `EMAIL_FROM` on the verified domain and `RESEND_API_KEY`, or `EMAIL_PROVIDER=smtp` with `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASSWORD`. These are backend worker secrets. Supabase Auth SMTP configuration alone does not send application alert emails. Confirm a real message arrives in a disposable inbox, test a provider outage/retry, and monitor failed delivery counts before setting frontend `NEXT_PUBLIC_ENABLE_EMAIL_ALERTS=true` and rebuilding.

**Chosen setup: Supabase Custom SMTP.** Use the same SMTP provider account already configured for Supabase Auth, but set its connection details separately in the ECHO backend worker environment (`EMAIL_PROVIDER=smtp`). Use the verified-domain sender address for `EMAIL_FROM`. Set `SMTP_SECURE=true` for implicit TLS (usually port 465) or `SMTP_SECURE=false` for STARTTLS (usually port 587); the worker requires TLS in the latter case. Do not put the SMTP password in Supabase SQL, Git, chat, or any `NEXT_PUBLIC_*` variable. Keep `EMAIL_PROVIDER=disabled` until the complete connection details are present, then restart the worker and verify one real alert in a disposable inbox before turning on the frontend availability flag.

For web push, generate one stable VAPID keypair, set backend `PUSH_VAPID_SUBJECT`, `PUSH_VAPID_PUBLIC_KEY`, and `PUSH_VAPID_PRIVATE_KEY`, and set only the matching public key in frontend `NEXT_PUBLIC_PUSH_VAPID_PUBLIC_KEY`. Deploy the frontend over HTTPS. ECHO exposes an installable manifest and 192/512 px icons; on iOS, install the web app to the Home Screen before enabling device alerts. The browser asks permission only when the user enables alerts in Settings. Test subscribe, receive, click-through, opt-out, sign-out, expired subscriptions, and the lock-screen privacy choice on real devices before exposing the public key. Push endpoints are restricted to known browser push services; add a newly supported provider deliberately after review. Device payloads never contain journal or support message text.

The disposable-account `test:live:reminders` check now also exercises the authenticated push registration API and channel queue against the linked database when `ECHO_LIVE_PUSH_API_QA=1`; it uses fake email and push senders and does not contact external delivery providers. Real email and device delivery remain unverified until the provider credentials and hosted worker are configured. Keep the frontend availability flags off until those checks pass.

## External configuration and staging check

Add the frontend callback URL to Supabase Auth redirect settings. Google sign-in uses a Google Cloud **Web application** OAuth client: `frontend/.env.local` `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, backend `GOOGLE_WEB_CLIENT_ID`, and Supabase Auth's Google provider must all accept the same client ID. Add the frontend's exact scheme, host, and port to that client's **Authorized JavaScript origins**; adding it to a different client does not authorize ECHO. With the frontend and backend running, use `npm run verify:google-origin -w frontend` before a demo or release. Set `ECHO_WEB_ORIGIN` to check another deployment. The command checks Google's live button response and reports the actual client ID when Google rejects the origin. Set backend `FRONTEND_URL` to the same frontend origin for CORS. Apply reviewed Supabase migrations before traffic reaches new services.

**Local auth check, 2026-10-18:** The linked project's redirect allow list now includes `http://127.0.0.1:3000/callback**`, which covers the callback's signup and recovery query parameters. A disposable recovery-link check preserved the requested 127.0.0.1 callback, and its QA account was deleted. The linked project still uses `http://localhost:3000` as its default site URL; no other Auth setting was changed. The active Google client begins `875072...`; Google's live button request still returns HTTP 403 for `http://127.0.0.1:3000` until that exact Web client's Authorized JavaScript origins are corrected. Hosted Auth currently has no custom SMTP and its email send limit is 2 per hour, so inbox delivery and resend acceptance remain unverified.

On a staging deployment, check `/api/v1/health`, sign-in, journal pagination and search, journal-to-settings/Buddy/grounding navigation, and sign-out/sign-in between different accounts. Measure cold starts separately from warm navigation; a sleeping free Render service can dominate latency. See [Render web services](https://render.com/docs/web-services) and [Render's Next.js guide](https://render.com/docs/deploy-nextjs-app).
