# Google authentication retirement

This release removes Google authentication from ECHO. A read-only check of `/auth/v1/settings` on 2026-10-31 reported Google disabled and email auto-confirmation disabled.

ECHO's login, signup, professional login, and Security settings now use email and password without a Google migration path. The Google registration endpoints, client SDK flow, browser script, client IDs, dependency, and CSP allowances are removed. The new migration `20261031130000_retire_google_auth.sql` makes signup email-only and removes Google-specific draft fields and the identity lookup RPC. Historical migrations remain unchanged. Existing Auth users and identities are not deleted by the migration.

Apply both 2026-10-31 migrations with the application release, then check that Google sign-in is rejected and that an email/password account can register and sign in. With SMTP disabled, choose whether to disable Confirm Email in Supabase or configure a working email delivery service; confirmation and password recovery still require email delivery when Confirm Email is enabled.

Lloyd will delete Google-linked accounts separately. Deleting an Auth user can affect records tied to its user ID, so check whether any account data needs to be retained before deleting it. This work performs no account deletion.
