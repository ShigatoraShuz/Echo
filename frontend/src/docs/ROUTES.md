# ECHO Frontend — Route Inventory

> Generated from Phase 0 audit (2026-07-13)

---

## Complete Route Map

| # | Route | Shell | Type | Page File | Description |
|---|-------|-------|------|-----------|-------------|
| 1 | `/` | PublicShell | Static | `app/page.tsx` | Landing page |
| 2 | `/about` | PublicShell | Static | `app/about/page.tsx` | About ECHO |
| 3 | `/privacy-policy` | PublicShell | Static | `app/privacy-policy/page.tsx` | Privacy policy |
| 4 | `/terms` | PublicShell | Static | `app/terms/page.tsx` | Terms of use |
| 5 | `/login` | PublicShell | Static | `app/login/page.tsx` | Login form |
| 6 | `/signup` | PublicShell | Static | `app/signup/page.tsx` | Signup form |
| 7 | `/forgot-password` | PublicShell | Static | `app/forgot-password/page.tsx` | Password reset request |
| 8 | `/reset-password` | PublicShell | Static | `app/reset-password/page.tsx` | New password form |
| 9 | `/onboarding/consent` | PublicShell | Static | `app/onboarding/consent/page.tsx` | Consent disclosures |
| 10 | `/onboarding/profile` | PublicShell | Static | `app/onboarding/profile/page.tsx` | Profile setup |
| 11 | `/onboarding/setup` | PublicShell | Static | `app/onboarding/setup/page.tsx` | Permissions setup |
| 12 | `/dashboard` | AppShell | Static | `app/dashboard/page.tsx` | Main dashboard |
| 13 | `/journal` | AppShell | Static | `app/journal/page.tsx` | Journal entry list |
| 14 | `/journal/new` | AppShell | Static | `app/journal/new/page.tsx` | New journal entry form |
| 15 | `/journal/[id]` | AppShell | SSG | `app/journal/[id]/page.tsx` | Journal entry detail (3 paths) |
| 16 | `/buddy` | AppShell | Static | `app/buddy/page.tsx` | Buddy chat interface |
| 17 | `/buddy/history` | AppShell | Static | `app/buddy/history/page.tsx` | Chat history |
| 18 | `/insights/emotion` | AppShell | Static | `app/insights/emotion/page.tsx` | Emotion pattern insights |
| 19 | `/insights/facial` | AppShell | Static | `app/insights/facial/page.tsx` | Facial trend privacy page |
| 20 | `/insights/risk` | AppShell | Static | `app/insights/risk/page.tsx` | Distress signal history |
| 21 | `/tools/grounding` | AppShell | Static | `app/tools/grounding/page.tsx` | Breathing/grounding tool |
| 22 | `/support/find-help` | AppShell | Static | `app/support/find-help/page.tsx` | Provider/clinic/hotline search |
| 23 | `/crisis` | Raw | Static | `app/crisis/page.tsx` | Full-screen crisis support |
| 24 | `/crisis-help` | PublicShell | Static | `app/crisis-help/page.tsx` | Crisis resources directory |
| 25 | `/settings/profile` | SettingsShell | Static | `app/settings/profile/page.tsx` | Profile settings |
| 26 | `/settings/privacy` | SettingsShell | Static | `app/settings/privacy/page.tsx` | Privacy controls |
| 27 | `/settings/notifications` | SettingsShell | Static | `app/settings/notifications/page.tsx` | Notification preferences |
| 28 | `/settings/trusted-contacts` | SettingsShell | Static | `app/settings/trusted-contacts/page.tsx` | Trusted contacts |
| 29 | `/settings/security` | SettingsShell | Static | `app/settings/security/page.tsx` | Security settings |
| 30 | `/settings/export` | SettingsShell | Static | `app/settings/export/page.tsx` | Data export controls |
| — | `/design-system` | Raw | Static | `app/design-system/page.tsx` | Design system showcase |

**Total: 30 routes** (29 functional app routes + 1 design-system showcase)

---

## Route Group Classification (Target)

Routes should be grouped into:

| Group | Routes |
|-------|--------|
| `(public)` | `/`, `/about`, `/privacy-policy`, `/terms`, `/crisis-help` |
| `(auth)` | `/login`, `/signup`, `/forgot-password`, `/reset-password` |
| `(onboarding)` | `/onboarding/consent`, `/onboarding/profile`, `/onboarding/setup` |
| `(protected)` | `/dashboard`, `/journal/**`, `/buddy/**`, `/insights/**`, `/tools/grounding`, `/support/find-help`, `/settings/**` |
| `crisis` | `/crisis` |

---

## Route Behavior Notes

- **`/journal/[id]`** uses `generateStaticParams` with 3 entries from mock data (`evening-window`, `meeting-aftercare`, `morning-static`)
- **Active route detection**: Not implemented. Navigation links do not highlight the current page.
- **Route transitions**: No loading states between route changes (Next.js defaults apply).
- **`/_not-found`**: Handled by `app/not-found.tsx` with link to `/dashboard`.
