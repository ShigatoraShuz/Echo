# Account activity, Buddy invitations and notifications

## Start clean

Settings > Data & account offers a permanent activity reset. The user enters START CLEAN and their current password. The client signs in again as the current account before calling the owner-scoped endpoint; the API also requires authentication within ten minutes. Client-supplied owner IDs are rejected.

The reset clears current and legacy journals/drafts, journal photos, derived analysis, Buddy chats, check-ins, grounding activity, calendar activity, notifications, export history and patient-owned professional requests/appointments. It preserves Auth login, profile/avatar, approved verification, consent, trusted contacts, preferences and restricted security audit records. Provider backups and existing audit retention are unaffected.

The SQL transaction stores a reset receipt and photo-cleanup paths. Database write guards and the single local-writer reset lock prevent activity from being recreated during cleanup. Local JSON generations invalidate in-flight results. Photo removal must succeed before the receipt is completed. A retry resumes the original receipt, including after a reload; replaying a completed request cannot erase newer activity. Other signed-in tabs receive an account-scoped reset event after success.

No real account is reset by installation, migration or tests. The permanent reset runs only after the in-app confirmation. The migration is service-role-only; ordinary authenticated database clients cannot call it or access its receipts.

## Buddy invitation

A non-modal, dismissible Buddy card appears only on Dashboard, Insights or Calendar, after an eight-second delay. It never opens over writing, Buddy chat/Talk, crisis support or Settings. It offers Buddy and the existing grounding tools and does not speak automatically or steal focus. Reduced-motion preferences disable its entrance animation.

Eligibility requires strong negative dominant emotion signals on the latest three analyzed dates within seven days, using one consistent model family. The latest point must be less than two days old and belong to the newest observed date; probability must be at least 0.35. Simulated, weak, future, invalid and stale points are ignored. Multiple reflections on one date count once. This is a product heuristic, not a clinical diagnosis or a risk score.

The backend checks approved AI access, analysis consent, in-app/insight notification preferences, quiet hours and a seven-day claim cooldown. The claim is atomic across tabs and creates a generic notification with a Buddy destination. Active unresolved local support workflows take priority.

## Notification operation

Existing verification, professional case and cloud-analysis triggers remain in place. Local analysis now records generic completed/failed notices through a deduplicated owner-scoped RPC. A delivery flag on local jobs enables recovery after process restart or temporary database failure; failure to notify never changes a completed model result into a failed result.

The integrated launcher starts the existing reminder/channel worker unless ECHO_NOTIFICATIONS_ENABLED=false. It honors preferences, quiet hours, deduplication and provider availability. Email requires configured SMTP or Resend; device push requires configured VAPID keys and a device subscription. Neither channel is claimed as delivered when unconfigured. Password-verification emails continue through Supabase Auth independently of app notification email.

Journal-only music and its assets are removed. The existing whole-app track remains, and dictation temporarily takes audio focus.

## Verification

Synthetic database tests cover owner isolation, retained identity/verification/preferences, reset recovery, write blocking, completed-request replay, ordinary-client denial, notification deduplication, consent and quiet hours. API tests cover recent authentication and rejection of forged owner IDs. UI tests cover deletion confirmation, reset password failure/retry, invitation placement/dismissal and the removal of journal music. No personal journals are deleted by these checks.


## Private laptop access

On the main PC, run `powershell -ExecutionPolicy Bypass -File scripts/start-private-server.ps1 -EnableBuddy -LocalActivity` after signing in to Tailscale. The explicit LocalActivity switch preserves this installation's existing local journal/Buddy storage while enabling the private HTTPS gateway and optimized frontend. Omitting it retains the existing hosted-worker startup behavior. No private hostname is committed.

The laptop must be connected to the same authorized Tailscale network. Keep the main PC powered on, awake and connected; stopping the app or the PC makes its private address unavailable. Tailscale Serve remains private to the tailnet.
