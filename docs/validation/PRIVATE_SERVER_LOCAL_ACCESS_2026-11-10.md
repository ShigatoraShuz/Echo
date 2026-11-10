# Main-PC local access alongside Tailscale — 2026-11-10

## Reproduction

The private frontend uses the configured Tailscale API address. Backend allowed origins contained only that HTTPS origin. Opening the same frontend at http://127.0.0.1:3000 made the private-session presence request cross-origin, and the backend rejected it with 403 before session validation. The UI displayed: We could not confirm your private session yet.

## Fix

For a non-production backend whose explicitly configured frontend origin is an HTTPS .ts.net origin, retain that exact origin and additionally permit only http://127.0.0.1:3000 and http://localhost:3000. No wildcard, arbitrary port, or arbitrary HTTPS origin is accepted. Production origin restrictions remain unchanged. Authentication and app-presence checks remain active.

This is intentionally scoped to the existing private development server. No Supabase configuration, password, verification gate, Tailscale Serve configuration, frontend build, or model settings changed.

## Verification

- Before fix: request carrying Origin http://127.0.0.1:3000 returned 403 without an allow-origin header.
- After fix: private readiness endpoint returned 200 with the matching allow-origin header for both exact local origins and the configured private HTTPS origin.
- Untrusted HTTPS origin still returned 403. Automated tests also reject an alternate local port.
- Four regression tests passed; backend typecheck and changed-file lint passed.
- Actual local browser reproduced the error, then successfully logged in with remembered credentials after the expired session was replaced. Dashboard loaded with account data; Journal navigation worked.
- Local screenshot saved in the project workspace as local-dashboard-fixed.jpg.
