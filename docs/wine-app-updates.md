# ECHO wine app updates — implementation and verification

Working branch: `feat/wine-app-updates`. Requested baseline: `main` at `915850a`.
Changes remain uncommitted. No push, remote migration, production Auth configuration, or secret change was performed.

## Existing implementation preserved

The repository already had a modular monolith, encrypted journals and one encrypted draft per user, atomic journal submission, HMAC-protected HTTP retry records, analysis workers and status projection, polling/Realtime progress, safety pauses and review, notification delivery, verified account gates, secure registration drafts and policy/age checks, Google OAuth, trusted-contact settings, Buddy conversations/voice controls, grounding session persistence, and dashboard analysis contracts.

The active editor had browser-only photo previews, but no persisted journal-image association or private upload path. It autosaved text but did not restore the remote draft. AI-estimated PHQ-8 values existed; a periodic self-reported questionnaire and its history did not.

## Changes and decisions

- **Analysis and progress:** retain canonical results, stages, retry, navigation, polling and Realtime. Improve next-step links, theme surfaces and reduced-motion bars. Show actual distress classifications; absent results no longer appear as a fabricated zero score in the touched dashboard/detail cards. Simulated output stays labeled. An urgent safety status reopens the safety experience and dismisses lower-priority dashboard prompts.
- **Completion notification:** retain the existing bell, journal deep link and unique completion index. Fix the SQL trigger to consult `user_service.notification_preferences`; the previous function referenced a nonexistent preferences table in `notification_service`. Both existing in-app and insight opt-ins remain required. Completion replay is tested to produce one notification.
- **PHQ-8:** eight self-reported responses, integer scoring 0–24, timestamp, severity and history under `insights_service`. Standard bands are minimal 0–4, mild 5–9, moderate 10–14, moderately severe 15–19, severe 20–24. First assessment is due immediately. The database computes the score and serializes submissions per user; replay/conflict handling and due enforcement prevent concurrent duplicate assessments. History retains all rows; the dashboard returns the latest 52 summaries. Answers are restricted service-owned database columns, not browser-readable tables or journal AI estimates. They are not encrypted with the journal application's encryption key.
- **Dashboard prompt order:** urgent safety takes priority, then a due PHQ-8, then an eligible repeated-pattern support suggestion. Welcome is dismissible inline content. PHQ-8 can be postponed and reopened from its dashboard card. It is explicitly screening, not diagnosis or immediate-safety assessment.
- **Repeated concerning results:** count distinct, nondeleted journals with completed, real, nonurgent `moderately_severe`/`severe` analysis results inside the configured window. Exclude simulated/demo output and self-reported PHQ-8 scores. An atomic persisted prompt claim enforces cooldown across tabs and sessions. Active urgent-safety jobs suppress this prompt. The user can open Find Help or trusted-contact settings; nothing sends automatically.
- **Access gates:** approved identity/account verification plus a complete, permitted contact from existing `user_service.trusted_contacts`. Completeness uses the existing settings shape: name, relationship, permission acknowledgement, and email or phone. This does not mark the contact verified. Existing verified-contact delivery requirements remain stricter and unchanged. Analysis keeps adult/account/onboarding, global/per-entry consent, policy-version and worker recheck safeguards. Blocked UI links to settings/verification while preserving the draft.
- **Overall analysis:** summarize actual saved reflections across 30 days, recorded moods, active days and recurring tags. Compare existing real-analysis distress classifications only when at least three days exist. The underlying trend value is the existing ordinal mapping of bands, not a clinical numerical score. Remove streak-derived invented activity counts.
- **Buddy and grounding:** retain feature services, handoffs, voice and persisted sessions. Improve Buddy's empty state, conversation labels, wrapping and motion behavior. Grounding cues follow elapsed phase timing, include visible senses-step progression and reduced motion, and reset the completion guard for a subsequent practice.
- **PH support:** retain the support-resource model; add reviewed source metadata and expose sources in Find Help/crisis views. Default lookup to the Philippines. Public directory access and emergency calls work without AI verification. Emergency 911 and NCMH 1553 remain directly available if directory loading fails. Calm surfaces and an exit link keep support accessible.
- **Email OTP login:** use Supabase `signInWithOtp` with `shouldCreateUser: false`, then `verifyOtp` with `type: 'email'`. Preserve remember-session behavior, password alternative and Google login. Prevent duplicate in-flight requests, keep the target email fixed during verification, provide a 60-second resend cooldown and invalid/expired feedback. OTP values are never written into the application database. Existing secure email/Google registration flows are unchanged.
- **Private images:** authenticated binary upload, JPEG/PNG/WebP signature/MIME checks, 5 MB per image and five images per journal. Reservations bind image ID, owner, journal and content hash; matching retries reuse the path. Only the backend accesses the private bucket, returning five-minute signed URLs. History and detail render actual uploaded images, without stock placeholders. Soft journal deletion and account cascades enqueue physical Storage API deletion for backend maintenance.
- **Drafts:** resume the existing single encrypted draft through `/journal/drafts`; block editing if restoration fails. Save the submission UUID before submitting, wait for an in-flight autosave, stop autosaving after acceptance, and condition draft cleanup on that UUID. A small SQL wrapper calls the original submission transaction and records an atomic receipt on the resulting journal. UUID-based draft retries remain idempotent after HTTP retry expiry and HMAC-key rotation. Changed payloads conflict; deleted journals are not recreated. Photo/cleanup failure retries reuse the accepted journal. Local browser storage contains analysis identifiers only.

## New migrations and rollout

Apply through the team's normal migration process to a disposable/local or staging Supabase project first, in filename order. Existing applied migration files were not edited.

| Migration | Purpose |
| --- | --- |
| `20260912010000_periodic_wellness_checkins.sql` | Screening history, scoring, due enforcement, repeated-result counting and persisted cooldown |
| `20260912011000_trusted_contact_ai_gate.sql` | Existing contact completeness and atomic analysis-gate extension |
| `20260912012000_journal_draft_submission_key.sql` | Submission UUID on existing encrypted drafts |
| `20260912013000_reviewed_philippine_support_resources.sql` | 13 officially published PH contact listings |
| `20260912014000_private_journal_images.sql` | Private bucket, authorized reservations and durable deletion queue |
| `20260912015000_fix_completion_notification_preferences.sql` | Correct existing completion trigger preferences ownership |
| `20260912016000_durable_draft_submission_receipts.sql` | Persistent UUID receipt around existing journal transaction |

New personal tables have RLS enabled, no anonymous/authenticated table privileges, and service-role-only access. Mutating RPCs are unavailable to browser roles. Account-owned records cascade on account deletion. Existing support-resource publication permissions remain in use. Shared TypeScript wellness contracts and journal DTO/model/service interfaces were updated. The legacy generated database file does not model these service schemas; do not hand-edit generated output to imply it was regenerated. Run the repository's local type-generation workflow against a migrated native Supabase instance as part of rollout.

Backend configuration is documented in `backend/.env.example`:

```dotenv
PHQ8_INTERVAL_DAYS=7
SUPPORT_PROMPT_THRESHOLD=3
SUPPORT_PROMPT_WINDOW_DAYS=14
SUPPORT_PROMPT_COOLDOWN_DAYS=7
```

Use `PHQ8_INTERVAL_DAYS=3` for a demo. Intervals are server configuration, not UI constants; changing them recalculates due/cooldown eligibility from persisted timestamps. Restart the backend after configuration changes.

Local Supabase now has a Magic Link email template containing `{{ .Token }}` in `supabase/templates/login-code.html`. Hosted projects must separately copy this template into the **Magic Link** Auth email template and verify SMTP delivery. Leave the signup confirmation template and `enable_confirmations` enabled. This configuration was not applied remotely. See [Supabase passwordless email documentation](https://supabase.com/docs/guides/auth/auth-email-passwordless).

## Verification results

- `npm test`: **352 frontend tests / 78 files; 175 backend tests / 35 files passed**.
- `npm run typecheck`: frontend and backend passed.
- `npm run lint`: zero errors; **66 frontend and 28 backend warnings** remain, including existing repository warnings and private-image `<img>` guidance.
- `npm run build`: contracts, Next.js production frontend and backend TypeScript compilation passed.
- `npm run check:auth-policy`: passed; Supabase/backend/frontend password policies remain aligned.
- `npm run test:sql:isolated`: full migration chain plus four SQL suites passed (analysis security, analysis transactions, wellness lifecycle, durable draft receipts).
- `git diff --check`: passed.

The SQL harness uses isolated PGlite PostgreSQL with Supabase platform stubs. It exercises actual migration functions/constraints/privileges; it does not replace native Supabase Auth, Realtime or Storage integration checks. The security test's exact projection whitelist now includes the existing `facial_status` column already added by main. No security assertion was removed to permit broader access.

Focused tests cover score boundaries/invalid answers, first and exact due boundaries/configurable interval, assessment replay/history, real-only distinct-journal thresholds, urgent separation, prompt cooldown, contact permission, completion-notification deduplication, image signatures/limits/ownership, draft restoration/finalization/photo retry, persistent receipt replay after expiry/rotation, OTP send/verify/cooldown and dashboard prompt priority.

## Resource sources and remaining human checks

Publication was reviewed during this implementation session (metadata date 2026-09-12). No test calls were made. A verified published number does not guarantee a current connection or carrier availability.

| Resource | Published contact included | Source and qualification |
| --- | --- | --- |
| Emergency services | 911 | [DILG nationwide campaign](https://ncr.dilg.gov.ph/dilg-leads-nationwide-campaign-for-unified-911-emergency-hotline/) |
| NCMH | 1553; 0919-057-1553; 0917-899-8727; 0966-351-4518 | [Quezon City, September 2026](https://quezoncity.gov.ph/national-suicide-prevention-week-4/). [DSWD FAQ](https://ekwentomo.dswd.gov.ph/faqs/) supports the 24/7 description for 0917-899-8727; [official NCMH advisory](https://ncmh.gov.ph/images/pdf/docs/ncmhcovid19publicadvise5.pdf) supports 1553's round-the-clock service. Carrier access still needs human checking. |
| In Touch | (02) 8893-7603; 0919-056-0709; 0917-800-1123; 0917-108-5412 | [Official organization site](https://in-touch.org/) publishes these crisis lines and 24/7 availability. |
| Hopeline | (02) 8804-4673; 0917-558-4673; 0918-873-4673 | [Quezon City official listing](https://quezoncity.gov.ph/national-suicide-prevention-week-4/). Current hours not independently confirmed; not labeled confirmed 24/7. |
| Cavite Center for Mental Health | (046) 419-0013 outpatient department | [Official provincial directory](https://cavite.gov.ph/directory/). Confirm clinic hours, appointment process and catchment; not an emergency or confirmed 24/7 service. |
| Philippine Red Cross | 143 | [Official contact page](https://redcross.org.ph/contact-us/). Emergency assistance; not presented as a dedicated mental-health crisis line. |

The migration adds missing exact name/number combinations and preserves other reviewed resources. Review existing staging/production directory records for duplicates or outdated independently managed entries before release. Do not infer that every preexisting record was reverified by this migration.

PHQ-8 wording, recall period and scoring follow [CDC questionnaire/scoring material](https://www.cdc.gov/mmwr/preview/mmwrhtml/su6003a1.htm) and [CDC PHQ-8 screening discussion](https://www.cdc.gov/pcd/issues/2011/mar/10_0097.htm). These are screening results, never a diagnosis; the questionnaire does not assess immediate safety.

## Manual verification and intentional limits

1. **Native Supabase:** Docker is unavailable in this environment. Apply the new migrations to a disposable native instance, regenerate service-schema types as supported, and run native security tests. Check private bucket policies, signed URL expiry, upload retries, soft-delete/account-delete storage cleanup, notification preferences/deep links and Realtime completion.
2. **Authentication:** test real OTP delivery, invalid/expired/resend behavior, session persistence, unknown accounts, verified email signup and Google registration/login. Local email-template configuration is included; hosted Auth changes remain a rollout task.
3. **Browser/device QA:** the installed browser tool returned no connected browser. Verify desktop/mobile layout, dark mode, keyboard focus/escape, reduced motion, Buddy voice and grounding cues in the running app. No screenshot-based or real-browser success is claimed.
4. **Schedules and safety:** use separate users for first login, not-due, 3-/7-day due, threshold/cooldown and urgent safety during an open questionnaire. Confirm urgent review/exit/logout remain reachable and no contact message sends automatically.
5. **Drafts and images:** the existing model remains one text draft per account. Selected photo files stay in browser memory until submission; they are not part of the encrypted remote draft and must be reselected after closing the page. The editor states this and warns before unloading selected files. Uploaded photos remain attached if a later upload fails; retry from the open editor. Concurrent editing on separate devices retains the existing single-draft last-write behavior; submission receipts prevent duplicate journals, not collaborative draft conflicts.
6. **Analysis availability:** real model providers, worker enablement, credentials and verification decisions are unchanged. Disabled/unavailable providers continue to use the existing waiting/failure behavior; these UI updates do not fabricate a real analysis provider.

No microservices split, registration redesign, new notification system, automatic trusted-person contact, public journal-image access, production configuration change, commit or push was introduced.

## Changed-file inventory

See [wine-app-updates-files.txt](wine-app-updates-files.txt) for the complete repository-relative inventory of modified and added files.
