# App flow audit — 2026-11-07

Scope: the running private Tailscale app on the existing review/journal-dashboard-insights-performance-20261102 branch after merge afa27a8. This is a tested-flow report, not a claim that every possible input, device or staff action has been exercised.

## Fixed defects

1. Profile Save sent the read-only avatarPath returned by GET settings. The strict PATCH schema rejected an unchanged form with “The request is invalid.” The shared settings client now sends only editable profile fields. The same defect in Privacy Save was fixed by excluding journalPrivate and availability flags. Backend validation remains strict.
2. Profile, privacy and notification PATCH endpoints return a SettingsSnapshot. The client incorrectly treated the whole snapshot as the saved section, which could break professional profile/appearance callers. It now returns the appropriate section; three regression checks cover payload filtering and return shapes.
3. Corrupted text encoding appeared in the live private-session loading screen and related verification, settings and dashboard labels. Corrected the strings and strengthened the loading-text regression assertion.
4. The route test manifest omitted /journal/resume. Added the owned-draft resume case; route coverage now maps 70 pages plus the authentication callback.
5. New engineering exports generated manifests pinned to obsolete Torch/Transformers versions even though the importer validated them in the current runtime. New manifests now pin the versions actually used for their tensor checks. Existing research manifests and weights remain untouched. Tiny-model tooling now passes its existing tokenizer object to the installed tokenizer API, and regression tests generate isolated temporary tiny models instead of using a stale optional artifact from the checkout.

## Automated validation

| Check | Result |
| --- | --- |
| Full frontend suite | 201 files, 1,348 tests passed |
| Full backend suite | 156 files passed, 5 skipped; 1,197 tests passed, 5 skipped |
| Full AI service suite | 521 passed, 2 skipped |
| Isolated PostgreSQL migration/security checks | 25 SQL checks passed |
| Frontend and backend type checking | Passed |
| Optimized private Next build | Passed and served after coordinated restart |
| Lint | 0 errors; 265 existing warnings remain |
| Route manifest | 70 pages and auth callback mapped |
| Git whitespace/conflict checks | Passed |

The Python suite initially had six failures. All were resolved and the complete suite was rerun. No model integrity, consent, resource-limit or response-approval checks were disabled to make tests pass. Automated staff-role and destructive-account cases ran through existing isolated tests; they were not enacted on real accounts.

## Live Tailscale/browser checks

| Flow | Evidence |
| --- | --- |
| Authenticated navigation | Dashboard, Journal, Calendar, Buddy, Insights, Grounding, Professional support, Find help and all seven settings sections opened |
| Dashboard details | Both analysis and past-30-days detail dialogs opened and closed; saved report loaded |
| Journal save and photo | Created one clearly marked synthetic reflection; uploaded the existing nonpersonal journal illustration as an explicit test photo; saved and reopened with one persisted photo and completed emotion/PHQ report |
| Saved-result propagation | Dashboard changed to 35 reflections with latest Trust/Others result; insights changed from 24 to 25 completed analyses and latest Trust 60% result |
| Journal search/filter | Synthetic title search isolated the test entry; incompatible Joy filter showed a proper no-results state; clearing restored entries |
| Insights controls | PHQ criteria dialog opened; preset period filter worked; invalid custom range produced validation. Successful native date-picker entry was not verified |
| Calendar | Saved a labeled synthetic reminder, marked it complete, navigated months and returned to today; saved completion persisted |
| Grounding | Started 5-4-3-2-1, advanced a sense, paused, changed duration to two minutes, resumed, completed the timer; weekly activity updated from 0/7 to 1/7 |
| Professional support | Overview, approved directory, credential expansion and request form opened. No support request or message was submitted to a person |
| Find help | Loaded resources, filtered Clinics, searched a no-match string and restored all resources |
| Crisis page | Loaded public resources; breathing cue started and ended. No hotline call, safety attestation or crisis journal was submitted |
| Profile Save | Reproduced invalid-request failure, deployed fix, then observed “Profile updated.” without changing values |
| Privacy Save | Observed “Privacy choices saved.” with existing choices retained |
| Notifications Save | Observed “Notifications saved.” with existing preferences retained |
| Trusted contacts | Existing list loaded; Add form opened with blank submit disabled, then canceled without changing contacts |
| Security/account | Audit-history and password/account controls loaded; no credential, sign-out-all or deletion action was executed |
| Buddy Chat | Existing synthetic conversation reopened after restart; a fictional schoolwork follow-up received a visible approved reply |
| Buddy voice UI | Speak latest reply changed from preparing to active playback; Stop returned the control to Speak and retained the approved reply |

## Real-model checks in the running service

- The ordinary and explicitly unsafe fictional safety fixtures produced false/true support flags respectively. Inputs were sent only to the loopback model service, not saved into the account crisis history.
- Default Talk warm succeeded, Nano produced 645,120 PCM bytes at 48 kHz/stereo, and Whisper transcribed the generated WAV to nonempty text. This is a generated-audio test, not proof of physical microphone operation or audible laptop speaker quality.
- Two ordinary CBT fixtures (progress and schoolwork) returned approved replies from transformers-peft-shared-nf4-v1 in approximately 8.9 seconds each. These are single warm fixtures, not general speed benchmarks.
- A final full warm/start -> Talk chat -> close test returned an approved schoolwork reply from that same engine and closed its owned session.
- One artificial meta-test prompt was withheld twice with BUDDY_RESPONSE_WITHHELD. Retrying with a heartbeat confirmed this was the existing response-approval policy, not a load/session failure. No rejected draft was displayed and no gate was bypassed. Do not infer universal response quality from the successful fixtures.
- A direct /v2/classify probe without journal ownership returned TALK_BUSY as designed; the valid Talk support-check lifecycle above succeeded. A warm_chat-only probe was not treated as a full Talk session; the final test used the actual warm/start lifecycle.
- Private frontend and API readiness returned HTTP 200; the internal runtime endpoint without its service credential returned 401. The private Tailscale configuration and hosted encrypted journal-worker profile were retained.

## Deferred or unavailable

- The user is on the laptop and explicitly postponed physical webcam/mic testing. Main-PC camera frames were live at 640x480, but no face was detected because nobody was in view. The journal reported no valid capture rather than inventing a facial result. Existing saved facial outputs remained visible separately in Insights.
- Optional MOSS v1.5 has no installed model bundle on this PC. Nano is the verified voice path.
- Email/push and scheduled reminder delivery are already labeled unavailable/future in the app; saving preferences does not prove those delivery services exist. No outside notifications were sent.
- Saved written AI perspective is absent for the current result and remains honestly unavailable. The model also does not estimate distress intensity, so the dashboard correctly says Not estimated.
- Admin/practitioner approvals, live professional communications, account deletion, password changes and full account-data downloads were not performed on real accounts. Their isolated automated coverage is distinct from live multi-user/device acceptance testing.

## State left for review

The app was rebuilt and restarted with the existing private launcher; Tailscale Serve stayed configured. One labeled synthetic photo journal, a completed labeled calendar reminder, a grounding completion and a fictional Buddy follow-up remain as review evidence. Existing journals, drafts, images, privacy choices and UI features were preserved. No new branch or remote push was requested.

Local screenshots/logs are in the Codex project workspace: app-audit-profile-fixed.png, app-audit-journal-photo.png, app-audit-insights-updated.png, app-audit-buddy-voice.png, app-audit-frontend-final.log, app-audit-js-final.log, app-audit-python-final.log, app-audit-sql.log and app-audit-talk-cbt-approved-final.log. They are intentionally not committed as user runtime data.
