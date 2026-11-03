# Tab navigation performance

Measured on November 3, 2026 in the local Next.js development app. These are repeat-navigation measurements from the same authenticated test account: click to a visible page heading/content heading, after one visit to each tab. They are not full network-idle timings or a promise that a first visit is instant.

| Tab | Before | After |
| --- | ---: | ---: |
| Dashboard | 2,851 ms | 91 ms |
| Journal | 835 ms | 60 ms |
| Calendar | 819 ms | 49 ms |
| Buddy | 3,333 ms | 1,313 ms |
| Insights | 2,330 ms | 1,315 ms |
| Grounding | 850 ms | 69 ms |
| Professional support | 645 ms | 44 ms |
| Find help | 129 ms | 79 ms |
| Settings | 825 ms | 53 ms |

## Implementation and freshness

- Next.js reuses page payloads for 60 seconds. Sidebar links request full prefetches in production; automatic prefetching remains disabled by Next.js in development.
- Display reads explicitly opt into a bounded, in-memory cache: Dashboard/Insights aggregates, navigation profile summary, and the public resource directory. At most 24 entries are retained; reuse expires after 60 seconds. Keys include the API origin, exact query and session token. No responses are written to local/session storage.
- Mutations invalidate before and after the request. Journal/analysis completion, privacy changes, session clearing, window focus, and visibility changes invalidate display reads. Avatar uploads also invalidate. Other-tab privacy changes invalidate via the storage event.
- Authorization, verification, consent, journal-support eligibility, model/job polling, private journal bodies, sharing permissions and messages are not cached by this display layer. Aborted caller requests bypass it.
- The new authenticated `/verification/access` endpoint returns only current AI eligibility. It uses the existing expiry normalization and trusted-contact check without loading administrator state, identity documents or decrypted application details.
- `/buddy/access` combines that live eligibility check with the owner's history preference; it reads the preference only when eligible. All existing message, voice, history and model endpoints retain their own guards. Buddy shares only an unresolved eligibility request across React effect replay.
- Both access endpoints send `Cache-Control: no-store`. Buddy and Insights therefore still wait on live backend/network checks. First visits in the development server also include route compilation/loading.

## Validation

The frontend suite passed 189 files / 1,255 tests; the affected backend suite passed 10 files / 61 tests. Additional focused tests passed after final avatar invalidation and Buddy request-coalescing changes. Type checks, changed-file lint and the production build passed.

Browser checks covered all nine sidebar routes, reuse of Dashboard display data, an AI completion forcing a fresh read, live Insights permission checks rejecting cached private content, and recovery after a fresh allowed check. The performance run used a controlled non-qualifying journal-support response to prevent the mandatory support dialog from blocking unrelated navigation measurements; other authentication, view data and access checks were real. No journal entries or messages were created by these checks.

Local timing and regression evidence is under `artifacts/merge-review/tab-performance-20261103/` (not part of the application bundle).
