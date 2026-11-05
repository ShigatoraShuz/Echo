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

## Private Tailscale frontend — 5 November 2026

The private-server shortcut now serves a prebuilt Next.js frontend with `next start`; the backend and native models retain their existing development/runtime profile. Ordinary `npm run dev` is unchanged. Use `scripts/start-private-server.ps1 -DevelopmentUI` when frontend hot reload is needed.

`prepare-private-frontend.mjs` rebuilds when frontend assets/source, shared contracts, dependency/config files or relevant public environment values change. An unchanged build is reused on restart. Output is isolated in ignored `frontend/.next-private/`. Build failures stop startup rather than serving a stale release.

- Fully prefetched route layouts use the standard five-minute Next.js lifetime; other page segments retain 60 seconds. This does not extend the display-data cache or cache API authorization decisions.
- Server-side route access checks use `GATEWAY_API_BASE_URL` on loopback instead of going through the private HTTPS proxy again. Bearer verification, no-store, denial handling and live account checks remain intact.
- Buddy and Insights show only a public header/loading shell while their existing live eligibility checks run. No messages, saved results or enabled private controls are exposed by these shells.
- Dashboard shows a public heading on first load and retains the currently mounted dashboard during a background model-result refresh. It does not cache an extra private snapshot between mounts. Session clearing still removes data.
- Loaded page layouts, animations, journal filters, sounds, face/voice features and model settings are retained.

### Actual browser measurements

Signed-in main-PC browser through the private HTTPS hostname. Values include browser automation overhead and measure click to a visible page heading. The repeat pass began 103 seconds after warming the pages, past the former 60-second route expiry. These are individual observations, not medians or laptop/school-network benchmarks.

| Tab | Repeat page opening | Private content ready where separately measured |
| --- | ---: | ---: |
| Calendar | 210 ms | Not separately timed |
| Buddy | 190 ms | 1,734 ms (composer visible after live access) |
| Insights | 172 ms | 2,019 ms (saved facial-result panel visible) |
| Grounding | 185 ms | Not separately timed |
| Professional support | 196 ms | Not separately timed |
| Find help | 188 ms | Not separately timed |
| Settings | 175 ms | Not separately timed |
| Dashboard | 265 ms | 2,425 ms (saved analysis summary visible) |
| Journal | 206 ms | Not separately timed |

A first click before background prefetch completes can still wait for a server request (first-pass Calendar: 1,620 ms; Buddy shell: 1,128 ms). Fresh private data and eligibility can still take seconds. Fast page opening does not mean instantaneous data, authorization or model inference. No access gate was mocked or bypassed in this run.

### Validation

- Final frontend suite: 193 files / 1,281 tests passed.
- Production build, including TypeScript checking, passed. Changed code lint passed; the existing Buddy test file has two unused-import warnings.
- Six existing launcher/private gateway checks passed. A live restart reused the prepared build.
- All nine sidebar destinations opened; loaded Dashboard Details and journal emotion filters worked, and the filter was restored to All entries. No journal or conversation was created or deleted for this performance run.
- No browser errors appeared in the final navigation pass. Backend and model service readiness returned ready. Face landmarker, MediaPipe WASM and Buddy voice worklet assets returned HTTP 200.
- Raw timing evidence is saved locally as `navigation-performance-20261105.json` in the Codex conversation workspace. The running server logs are under `artifacts/model-integration/buddy-repair-20261104/navigation-live-20261105*.log`.
