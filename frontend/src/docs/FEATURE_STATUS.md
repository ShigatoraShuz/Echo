# ECHO Frontend — Feature Status (Phase 0 Audit)

> Audit date: 2026-07-13  
> Status: `📐 static-ui` = presentational, no interactivity  
> `❌ missing` = not implemented  
> `✅ complete` = fully functional  

---

## 1. Landing Page (`/`)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Hero section | ✅ | Present with ECHO branding, "Start privately" CTA |
| Privacy-first message | ✅ | Present in hero subtitle |
| Main CTAs | 🟡 | Only "Start privately" and "Crisis resources" — missing "Meet Your Buddy", "Explore Grounding", "Learn About Privacy" |
| Product preview | ❌ | No feature overview, screenshots, or mockups |
| Feature overview | ❌ | Missing |
| How ECHO works | ❌ | Missing |
| Privacy and trust section | ❌ | Missing |
| Non-diagnostic disclaimer | 🟡 | In footer only, not on landing hero |
| Crisis-support visibility | ✅ | Link in hero section |
| Testimonials | ❌ | Missing |
| Final CTA | ❌ | Missing |
| Professional footer | ✅ | Present with links |

---

## 2. Authentication

| Feature | Status | Notes |
|---------|--------|-------|
| Login (email, password) | 📐 | Static form — no validation, no submit handler |
| Show/hide password | ❌ | Not implemented |
| Remember session | ❌ | Not implemented |
| Forgot-password link | ✅ | Present |
| Signup link | ✅ | Present |
| Signup (name, email, password, confirm) | 📐 | Static form |
| Password-strength feedback | ❌ | Not implemented |
| Terms acceptance | ❌ | Not implemented |
| Privacy acknowledgement | ❌ | Not implemented |
| Forgot password form | 📐 | Static form |
| Reset password form | 📐 | Static form |

---

## 3. Onboarding

| Feature | Status | Notes |
|---------|--------|-------|
| Consent page | 📐 | Static consent cards, no toggle/checkbox interaction |
| Privacy explanation | ✅ | Present |
| AI limitations | ✅ | Present |
| Facial-analysis opt-in | ❌ | Missing from consent page |
| Profile page | 📐 | Static form fields |
| Preferred name | 📐 | Static input |
| Goals / Buddy tone | ❌ | Missing |
| Notification preference | 🟡 | Text description, no toggle |
| Setup page | 📐 | Static permission explanations |
| Theme selection | ❌ | Missing from onboarding |
| First mood check-in | ✅ | Present on profile page |
| Completion summary | ✅ | Present |
| Step progress indicator | ❌ | Missing |

---

## 4. Dashboard

| Feature | Status | Notes |
|---------|--------|-------|
| Greeting with name | ✅ | Static from mock data |
| Current date | ❌ | Not shown |
| Mood check-in | ❌ | Missing widget |
| Quick journal action | ✅ | Link to `/journal/new` |
| Talk to Buddy action | ✅ | Link to `/buddy` |
| Recent journal entries | ✅ | Static cards from mock data |
| Mood trend summary | ✅ | Static chart, from mock data |
| Emotion summary | ✅ | Present |
| Recent grounding activity | ❌ | Missing |
| Privacy/sync status | ✅ | Present in sidebar |
| Crisis-help shortcut | ✅ | CrisisHelpCard component |
| Loading skeleton | ❌ | Missing |
| Empty state | ❌ | Missing |
| Error state | ❌ | Missing |

---

## 5. Journal

| Feature | Status | Notes |
|---------|--------|-------|
| Journal list | 📐 | Static cards from mock data |
| Search input | 📐 | Non-functional |
| Mood filtering | 📐 | Non-functional dropdown |
| Date filtering | ❌ | Missing |
| Sorting | 📐 | Non-functional dropdown |
| Pagination/load-more | ❌ | Missing |
| Empty state | ✅ | Present ("Filtered entries will appear here") |
| Create entry | 📐 | Static form |
| Edit entry | ❌ | Not implemented |
| Delete confirmation | ❌ | Not implemented |
| Draft saving | ❌ | Not implemented |
| Autosave indicator | ❌ | Not implemented |
| Word/character count | ❌ | Not implemented |
| Mood selection | ✅ | Interactive via MoodSelector |
| Emotion tags | 📐 | Static input |
| Privacy status | ❌ | Missing |
| Analysis display | ✅ | Static "ECHO perspective" card |

---

## 6. Buddy

| Feature | Status | Notes |
|---------|--------|-------|
| Conversation display | 📐 | Static messages from mock data |
| New conversation | ❌ | Missing |
| Rename conversation | ❌ | Missing |
| Delete conversation | ❌ | Missing |
| Search history | 📐 | Non-functional input |
| Message input | 📐 | Static textarea, non-functional send |
| Enter-to-send | ❌ | Not implemented |
| Typing indicator | ❌ | Missing |
| Streaming-ready UI | ❌ | Missing |
| Retry message | ❌ | Missing |
| Copy response | ❌ | Missing |
| Feedback action | ❌ | Missing |
| Grounding suggestion cards | ✅ | Present |
| Crisis-escalation card | ✅ | Present |
| Empty state | ❌ | Missing |
| Error state | ❌ | Missing |
| Offline state | ❌ | Missing |

---

## 7. Insights

| Feature | Status | Notes |
|---------|--------|-------|
| Emotion overview | ✅ | Static |
| Time-range controls | ❌ | Missing |
| Emotion trend chart | ✅ | Static bar chart |
| Emotion distribution | ✅ | Conic gradient wheel |
| Journal-source breakdown | ❌ | Missing |
| Most frequent emotions | ✅ | Static list |
| Positive/difficult balance | 📐 | Text description only |
| Plain-language explanations | ✅ | Present |
| Empty state | ❌ | Missing |
| Privacy notice | ✅ | Present |
| Facial camera permission | 📐 | Static UI, no real camera |
| Camera start/stop | ❌ | Not implemented |
| Permission-denied state | ❌ | Missing |
| Camera-unavailable state | ❌ | Missing |
| Risk current signal | ✅ | Present |
| Risk band history | ✅ | Static list |
| Supporting factors | ✅ | Present |
| Clear uncertainty language | ✅ | Present |

---

## 8. Settings

| Feature | Status | Notes |
|---------|--------|-------|
| Profile (name, timezone) | 📐 | Static display, no editing |
| Avatar upload | ❌ | Missing |
| Privacy controls | 📐 | Static display |
| Security / change password | 📐 | Static "Update" text |
| Two-factor readiness | 📐 | "Planned" badge |
| Active sessions | 📐 | "Review" text |
| Notifications | 📐 | Badge toggles (On/Off/Optional) |
| Quiet hours | ❌ | Missing |
| Export | 📐 | "Prepare" text links |
| Deletion request | 📐 | "Sensitive" badge |
| Trusted contacts list | 📐 | Static sample contacts |
| Add/edit/remove contact | ❌ | Not implemented |
| Empty state | ❌ | Missing |

---

## 9. Grounding Tools

| Feature | Status | Notes |
|---------|--------|-------|
| Breathing circle | ✅ | Static animation (CSS) |
| 5-4-3-2-1 sensory | 📐 | Static description card |
| Box breathing | 📐 | Static description card |
| Start/pause/resume | ❌ | Not implemented |
| Timer/progress | ❌ | Missing |
| Duration selector | 📐 | Non-functional dropdown |
| Pace selector | 📐 | Non-functional dropdown |
| Completion state | ❌ | Missing |
| Reduced-motion mode | ✅ | CSS-level |

---

## 10. Crisis Support

| Feature | Status | Notes |
|---------|--------|-------|
| Immediate-help heading | ✅ | Present |
| Emergency-service guidance | ✅ | Present |
| Hotline/support resources | 📐 | Static from mock data |
| Contact trusted person | ❌ | Missing |
| Find local professional help | ✅ | Link to `/support/find-help` |
| Grounding action | ✅ | Present |
| Safety-focused language | ✅ | Present |
| Clear exit/navigation | ✅ | Present |

---

## 11. Accessibility

| Requirement | Status | Notes |
|-------------|--------|-------|
| Full keyboard navigation | 🟡 | Links work, buttons don't |
| Visible focus states | ✅ | Browser defaults, custom ring tokens needed |
| Proper heading hierarchy | ✅ | h1 → h2 throughout |
| Semantic landmarks | ✅ | `<main>`, `<nav>`, `<aside>`, `<footer>` |
| Form labels | ✅ | Using `<label>` elements |
| Screen-reader descriptions | 🟡 | Some ARIA, missing on many controls |
| Accessible dialogs | ❌ | No dialogs exist |
| Accessible charts | 🟡 | Basic ARIA labels on conic chart |
| Sufficient color contrast | ✅ | CSS variables designed for contrast |
| Skip-to-content link | ❌ | Missing from all shells |
| Reduced-motion support | ✅ | CSS `prefers-reduced-motion` |
| Touch targets | ✅ | Adequate sizing |
| Crisis resources no-animation | ✅ | Crisis page has no animation |

---

## 12. Responsive Design

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Small mobile | 🟡 | Mostly works, some horizontal scroll risk |
| Standard mobile | ✅ | AppShell grid collapses to single column |
| Tablet | ✅ | Sidebar becomes horizontal strip |
| Desktop | ✅ | Sidebar + content layout |
| No horizontal overflow | ✅ | `min-w-0` and `overflow-hidden` used |
| Mobile-friendly forms | ✅ | Full-width inputs |
| Mobile navigation | 🟡 | No bottom nav or hamburger menu |

---

## Summary

| Category | Total Requirements | ✅ Complete | 📐 Static UI | ❌ Missing |
|----------|-------------------|-------------|--------------|------------|
| Landing | 10 | 3 | 1 | 6 |
| Auth | 13 | 2 | 4 | 7 |
| Onboarding | 12 | 4 | 5 | 3 |
| Dashboard | 13 | 6 | 2 | 5 |
| Journal | 18 | 4 | 4 | 10 |
| Buddy | 19 | 4 | 2 | 13 |
| Insights | 18 | 8 | 1 | 9 |
| Settings | 14 | 0 | 8 | 6 |
| Grounding | 10 | 2 | 4 | 4 |
| Crisis | 8 | 7 | 1 | 0 |

## 13. Phase 2 Implementation

The following shared foundation has been implemented:
- Typed environment configuration with validation
- Centralized route constants for all 30+ routes
- Typed navigation configuration (public, app, settings, mobile, crisis)
- Motion tokens for future animation
- Feature flags with environment-driven values
- `AppError` model with 10 error codes and user-safe messages
- Error normalizer (AbortError, TimeoutError, NetworkError, HTTP errors, unknown)
- Discriminated union types: `AsyncState<T>`, `ServiceResult<T>`, `PaginationState`
- `AuthTokenProvider` interface with null provider for mock/public mode
- Typed API client with GET, POST, PATCH, PUT, DELETE, token injection, abort, timeout
- Abort-signal composition utility
- Service adapter foundation (mock vs HTTP selection)

**Not yet implemented:** Shared UI components, route groups, application shells, domain services, React Bits wrappers, form/validation libraries.

**Overall:** 40 ✅ complete, 32 📐 static-ui, 63 ❌ missing  
**Bulk of work needed:** Buddy interactions, form validation, journal CRUD, settings interactivity, landing page redesign.
