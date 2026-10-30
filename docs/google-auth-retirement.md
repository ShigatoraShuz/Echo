# Google authentication retirement

Status: migration stage. Normal login, professional login, and signup screens use email only. Existing Google-linked users can still sign in at `/google-migration` to reach Security settings. Do not disable the Supabase Google provider or remove that migration path yet.

On 2026-10-30, the linked ECHO UPDATED THESIS2 production project's Magic link or OTP template was changed from the default sign-in link to the branded code template in `supabase/templates/login-code.html`. The dashboard confirmed the save and retained the template after reload. A real delivered code, login, and migration verification have not yet been tested.

The linked project had eight Google-linked accounts without a recorded email identity on 2026-10-30. An identity row alone does not prove whether password or email-code login works. Preserve each `auth.users.id` and all associated records.

## Release gates

1. Confirm custom SMTP is configured for the target Supabase project. On a disposable account, complete email signup confirmation, email-code login, and password recovery at the deployed callback URL. The 2026-10-18 deployment notes reported no custom SMTP, so do not rely on that old status as a current check.
2. Re-enumerate Auth users in **each** target project. For every Google-linked user, have them sign in and use Security settings → **Move your Google sign-in to email**. The flow sets a password and checks password and email-code sessions against the original user ID. Verify their profile and existing data remain on that ID. Record only IDs and pass/fail status in a restricted operator checklist; never record passwords, codes, links, or journal content.
3. For anyone unable to use Google, generate a one-time recovery link for their existing verified email through a trusted admin session, deliver it through the configured mail service, and check that redemption returns the original ID. Test this route with a disposable Google-only account first. If it creates another account or cannot deliver, stop the cutover; do not create a replacement user.
4. Require every affected user to pass both email methods before cutover. A generic success response from an email send API is not proof of delivery.

## Cutover after the gates pass

- Remove the temporary `/google-migration` route and Security settings migration UI, then remove the GIS loader, legacy OAuth helper, Google registration endpoints and verification code, Google client IDs, dependency, and Google CSP origins. Keep `/callback` for email confirmation and recovery.
- Add a new SQL migration that makes `auth_provisioning.before_user_created` and `provision_new_user` email-only while retaining the eligibility, reservation, policy, and profile-provisioning checks. Remove the Google draft fields/index, Google identity-status RPC, and Google fields from the draft-update RPC. Do not edit applied migration history or delete existing `auth.users` or `auth.identities` rows.
- Publish and activate new versions of the policy documents that describe email authentication accurately. Existing users will pass through the policy review gate for the new versions.
- Deploy code and migration together, disable the Supabase Google provider, then verify Google auth is rejected. If a migrated account cannot sign in, re-enable the provider and restore the previous app release while investigating; do not change user IDs.

Google's browser script runs on authentication screens. Its removal should be timed there. Investigate signed-in page lag as a separate performance task.
