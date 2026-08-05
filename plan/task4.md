# ECHO Advanced Feature Expansion — Weekly Summary + 30 New Features

**Document:** `plan/task4.md`
**Project:** Echo
**Purpose:** Define 31 new features (1 Weekly Journal Summary + 30 security, entertainment, fun, and safety features) with complete frontend MVVM design, backend Express architecture, Supabase database schema, and AI service integration details.

---

# Part 1: Weekly Journal Summary (ECHO Weekly)

> Inspired by Spotify Wrapped — a weekly pop-up summary of journaling activity, emotions, and AI-generated reflective insight.

## 1.1 Product Concept

After 7 days of app usage, a celebratory modal/page appears showing:
- **Journal stats:** Total entries, total words written, journal streak (consecutive days)
- **Emotion breakdown:** Most frequent mood + top 3 emotions with count (e.g., "You felt *grateful* 12 times this week")
- **Mood distribution chart:** Visual breakdown of all moods logged
- **Buddy highlights:** Most meaningful Buddy conversation snippet
- **AI reflective insight:** Fine-tuned model generates a 1-2 sentence personalized reflection based on the week's patterns
- **Share card:** Anonymized, privacy-safe summary card (downloadable image, no PII)

The summary regenerates weekly. It auto-pops on dashboard load when 7+ days have passed since last summary. Users can dismiss, view full page, or access past summaries from settings.

## 1.2 Frontend Architecture

### New Feature: `features/weekly-summary/`

```text
frontend/src/features/weekly-summary/
├── view/
│   ├── WeeklySummaryView.tsx          # Full-page summary view
│   └── WeeklySummaryModal.tsx         # Modal variant (popup on dashboard)
├── view-model/
│   └── useWeeklySummaryViewModel.ts   # State: loading, data, dismiss, regenerate
├── model/
│   ├── weekly-summary.model.ts        # WeeklySummary, WeeklyEmotion interfaces
│   ├── weekly-summary.schema.ts       # Zod validation
│   └── weekly-summary.mapper.ts       # DTO to client model
├── components/
│   ├── WeeklySummaryCard.tsx          # Shareable summary card
│   ├── WeeklyStatsRow.tsx             # Total entries, words, streak display
│   ├── WeeklyEmotionBreakdown.tsx     # Top emotions with horizontal bars
│   ├── WeeklyMoodChart.tsx            # Mood distribution bar chart
│   ├── WeeklyAiInsightCard.tsx        # AI reflection display
│   ├── WeeklyBuddyHighlight.tsx       # Buddy conversation highlight
│   └── WeeklyShareButton.tsx          # Export/download as image
├── services/
│   ├── weekly-summary.service.ts      # Interface
│   ├── weekly-summary.mock-adapter.ts # Deterministic mock data
│   ├── weekly-summary.http-adapter.ts # API calls
│   └── weekly-summary.factory.ts      # Mock/HTTP selection
└── index.ts
```

### ViewModel States

```ts
interface WeeklySummaryState {
  summary: WeeklySummary | null;
  isLoading: boolean;
  error: string | null;
  isDismissed: boolean;
  hasNewSummary: boolean; // true when 7+ days since last
}
```

### ViewModel Actions

```ts
interface WeeklySummaryActions {
  loadLatest: () => Promise<void>;
  dismissSummary: () => void;
  regenerateSummary: () => Promise<void>;
  viewFullPage: () => void;
  shareSummary: () => Promise<void>;
}
```

### Route

- `/summary/weekly` — Full-page summary (protected)
- Dashboard auto-checks on mount: `GET /api/v1/weekly-summaries/latest`

### Animations

- `EchoReveal` on stats (staggered)
- `EchoCountUp` on numbers (entries, words, streak)
- `EchoAnimatedList` on emotion items
- `EchoBlurText` on AI insight entrance
- No animation on crisis users (respects `prefers-reduced-motion`)

## 1.3 Backend Architecture

### New Feature Module: `features/weekly-summaries/`

```text
backend/src/features/weekly-summaries/
├── weekly-summaries.routes.ts
├── weekly-summaries.controller.ts
├── weekly-summaries.service.ts
├── weekly-summaries.repository.ts
├── weekly-summaries.validator.ts
├── weekly-summaries.model.ts
├── weekly-summaries.mapper.ts
└── index.ts
```

### API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/v1/weekly-summaries/latest` | Get most recent summary | Yes |
| `POST` | `/api/v1/weekly-summaries/generate` | Generate new weekly summary | Yes |
| `GET` | `/api/v1/weekly-summaries/history` | List past summaries | Yes |
| `GET` | `/api/v1/weekly-summaries/:id` | Get specific summary | Yes |

### Service Logic (`weekly-summaries.service.ts`)

1. **Generate flow:**
   - Check if summary already exists for current `week_start` — return cached
   - Query `journal_entries` for the past 7 days (`WHERE created_at >= week_start AND user_id = $1`)
   - Aggregate: count entries, sum words (body length), compute streak from consecutive days
   - Aggregate mood distribution and top emotions
   - Find Buddy conversation with most messages in period
   - Construct AI prompt with anonymized aggregate data (no raw journal text)
   - Call FastAPI `/v1/weekly-reflect` endpoint
   - Store result in `weekly_summaries` table
   - Return complete summary

2. **AI Prompt construction** (no raw journal text sent):
   ```
   Given this user's weekly emotional data:
   - Most frequent mood: {mood}
   - Emotion distribution: {emotions}
   - Journal entries: {count}
   - Mood trend: {trend}

   Generate a 1-2 sentence reflective insight that is warm, supportive, and non-diagnostic.
   ```

## 1.4 Database Schema

### New Table: `weekly_summaries`

```sql
CREATE TABLE weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_entries INT NOT NULL DEFAULT 0,
  total_words INT NOT NULL DEFAULT 0,
  journal_streak_days INT NOT NULL DEFAULT 0,
  most_frequent_mood TEXT,
  top_emotions JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{"emotion": "joy", "count": 12, "percentage": 40}, ...]
  mood_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Format: {"calm": 5, "happy": 3, "sad": 2, "anxious": 1, "angry": 0, "neutral": 4}
  ai_insight TEXT,
  buddy_highlight_title TEXT,
  buddy_highlight_snippet TEXT,
  model_version TEXT,
  summary_version INT NOT NULL DEFAULT 1,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_week UNIQUE (user_id, week_start)
);

-- RLS
ALTER TABLE weekly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own summaries"
  ON weekly_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own summaries"
  ON weekly_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own summaries"
  ON weekly_summaries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own summaries"
  ON weekly_summaries FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_weekly_summaries_user_week
  ON weekly_summaries (user_id, week_start DESC);

CREATE INDEX idx_weekly_summaries_generated
  ON weekly_summaries (user_id, generated_at DESC);
```

## 1.5 FastAPI AI Endpoint (New)

```text
POST /v1/weekly-reflect
```

Request:
```json
{
  "request_id": "uuid",
  "user_id": "uuid",
  "most_frequent_mood": "calm",
  "mood_distribution": {"calm": 5, "happy": 3, "sad": 2},
  "top_emotions": [{"emotion": "joy", "count": 12}],
  "total_entries": 7,
  "journal_streak_days": 7,
  "mood_trend": "improving"
}
```

Response:
```json
{
  "request_id": "uuid",
  "insight": "This week shows a gentle upward trend in calm moments — your consistent journaling practice is helping you track what brings you peace.",
  "model_version": "echo-weekly-v1",
  "processing_time_ms": 450
}
```

---

# Part 2: Security Features (10)

---

## 2.1 Biometric Unlock

**Concept:** Fingerprint / Face ID for quick app re-entry after session timeout, without typing password.

### Frontend

- `features/biometric-auth/`
  - `view/BiometricSetupView.tsx` — Setup/enroll biometric
  - `view/BiometricPromptView.tsx` — Quick unlock dialog
  - `view-model/useBiometricViewModel.ts` — State: available, enrolled, locked
  - `model/biometric.model.ts` — BiometricAvailability, BiometricPreference
  - `services/biometric.service.ts` — WebAuthn API wrapper
- Settings toggle: `/settings/security` to "Quick biometric unlock"
- Uses WebAuthn API (`navigator.credentials.create()` / `navigator.credentials.get()`)
- Stores credential ID locally (IndexedDB), never sends to server
- Fallback: PIN code if biometric unavailable

### Backend

- `POST /api/v1/biometric/register-challenge` — Get challenge for WebAuthn registration
- `POST /api/v1/biometric/register` — Store credential ID (hashed)
- `POST /api/v1/biometric/verify-challenge` — Get challenge for auth
- `POST /api/v1/biometric/verify` — Verify assertion
- Store `biometric_credentials` table for backup verification

### Database

```sql
CREATE TABLE biometric_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  device_name TEXT,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

ALTER TABLE biometric_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their credentials"
  ON biometric_credentials FOR ALL
  USING (auth.uid() = user_id);
```

---

## 2.2 Active Session Management UI

**Concept:** View all active sessions, remotely revoke unknown sessions.

### Frontend

- `features/sessions/`
  - `view/SessionListView.tsx` — Table of active sessions
  - `components/SessionRow.tsx` — Device, location, last active, revoke button
  - `view-model/useSessionListViewModel.ts`
  - `model/session.model.ts` — ActiveSession interface
- Route: `/settings/security` (extend existing)
- States: loading, empty (no other sessions), error, confirm revoke dialog

### Backend

- `GET /api/v1/sessions` — List active sessions for user
- `DELETE /api/v1/sessions/:sessionId` — Revoke specific session
- `DELETE /api/v1/sessions/others` — Revoke all other sessions
- Derive sessions from Supabase Auth `sessions` table or custom `user_sessions` table

### Database

```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT,
  device_type TEXT,
  ip_address INET,
  location_city TEXT,
  location_country TEXT,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  is_current BOOLEAN DEFAULT false
);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their sessions"
  ON user_sessions FOR ALL
  USING (auth.uid() = user_id);
```

---

## 2.3 Login Device Alerts

**Concept:** Push or email notification when a new device/location logs into the account.

### Frontend

- Notification display in existing notification center
- Settings toggle: `/settings/security` to "Login alerts"
- `model/security-alert.model.ts` — SecurityAlert interface

### Backend

- Auth middleware hooks: on successful login, compare IP/location against known sessions
- If new device detected: queue notification (email via Resend/SendGrid, push via Supabase Realtime)
- `POST /api/v1/security/alerts` — CRUD for alert preferences
- `GET /api/v1/security/alerts` — List recent security alerts

### Database

```sql
CREATE TABLE security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'new_device', 'new_location', 'password_changed'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  device_name TEXT,
  location_city TEXT,
  location_country TEXT,
  ip_address INET,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their alerts"
  ON security_alerts FOR ALL
  USING (auth.uid() = user_id);
```

---

## 2.4 End-to-End Encrypted Buddy Chats

**Concept:** Extend AES-256-GCM encryption from journal entries to Buddy conversations.

### Frontend

- Encryption key derived from user's master key (stored locally, never sent to server)
- Messages encrypted client-side before sending, decrypted after receiving
- `services/chat-encryption.service.ts` — Encrypt/decrypt using Web Crypto API
- IV + ciphertext stored server-side, key never leaves client
- Indicator: "End-to-end encrypted" badge on chat header

### Backend

- Modify `buddy_messages` table: add `encrypted_content` column (BYTEA or TEXT), drop plaintext `content`
- No server-side key access — server stores opaque ciphertext only
- Decryption happens exclusively on frontend

### Database

```sql
ALTER TABLE buddy_messages ADD COLUMN encrypted_content TEXT;
ALTER TABLE buddy_messages ADD COLUMN encryption_iv TEXT;
ALTER TABLE buddy_messages ADD COLUMN encryption_version INT DEFAULT 1;
-- Migrate: populate encrypted_content from content, then make encrypted_content NOT NULL
-- After migration: DROP COLUMN content (plaintext)
```

---

## 2.5 Encrypted Data Export Bundles

**Concept:** Export journals with a password-protected ZIP archive. Password is never stored on server.

### Frontend

- Export flow: select format (PDF/TXT/JSON), set export password
- `features/data-export/` (extend existing)
  - `components/ExportPasswordDialog.tsx` — Set password before download
  - `services/export-encryption.service.ts` — Client-side encryption
- Password used to derive AES key (PBKDF2), file encrypted client-side before upload
- Server stores encrypted blob, only returns it on download — decryption is client-side

### Backend

- `POST /api/v1/exports` — Accept export request with encrypted payload
- `GET /api/v1/exports/:id/download` — Return encrypted file
- Server never sees password

### Database

```sql
ALTER TABLE export_requests ADD COLUMN encryption_method TEXT DEFAULT 'aes-256-gcm-pbkdf2';
ALTER TABLE export_requests ADD COLUMN is_encrypted BOOLEAN DEFAULT false;
```

---

## 2.6 Two-Factor Authentication (TOTP)

**Concept:** App-based 2FA via authenticator codes (Google Authenticator, Authy).

### Frontend

- `features/two-factor/`
  - `view/TotpSetupView.tsx` — QR code scan, manual code entry
  - `view/TotpVerifyView.tsx` — Code prompt on login
  - `view-model/useTotpViewModel.ts`
  - `components/TotpQrCode.tsx` — QR display
  - `components/BackupCodesList.tsx` — Recovery codes
- Route: `/settings/security/two-factor`
- States: setup (not enabled), enabled, verify on login
- Backup codes: generate 10 single-use codes, show once, hash stored server-side

### Backend

- `POST /api/v1/auth/2fa/setup` — Generate secret, return QR URI
- `POST /api/v1/auth/2fa/verify` — Verify TOTP code, enable 2FA
- `POST /api/v1/auth/2fa/disable` — Disable (requires current password)
- `POST /api/v1/auth/2fa/recovery` — Use recovery code
- Modify login flow: if 2FA enabled, return `requires_2fa: true`, challenge for TOTP

### Database

```sql
CREATE TABLE user_2fa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  totp_secret TEXT NOT NULL, -- encrypted at rest
  is_enabled BOOLEAN DEFAULT false,
  backup_codes TEXT[], -- hashed
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their 2FA settings"
  ON user_2fa FOR ALL
  USING (auth.uid() = user_id);
```

---

## 2.7 Quick PIN Lock

**Concept:** Separate 4-6 digit PIN for fast re-entry without full session re-auth.

### Frontend

- PIN setup in `/settings/security`
- PIN prompt on app resume after timeout (>5 min background)
- PIN hashed locally with salt (bcrypt-like), only hash stored server-side
- `services/pin-lock.service.ts` — Set, verify, clear PIN

### Backend

- `POST /api/v1/auth/pin/set` — Store PIN hash
- `POST /api/v1/auth/pin/verify` — Verify PIN (return short-lived token)
- `POST /api/v1/auth/pin/remove` — Remove PIN

### Database

```sql
ALTER TABLE profiles ADD COLUMN pin_hash TEXT;
ALTER TABLE profiles ADD COLUMN pin_salt TEXT;
```

---

## 2.8 Suspicious Activity Detection

**Concept:** Flag unusual login patterns (rapid geo-switches, brute force attempts, impossible travel).

### Frontend

- `features/security-alerts/`
  - `view/SecurityAlertsView.tsx` — Alert feed
  - `components/AlertCard.tsx` — Individual alert with action
- Route: `/settings/security/alerts`

### Backend

- Auth middleware: log login events with IP, geo, timestamp
- Background job/request-time check: if login from IP in country A then country B within <1 hour => flag as suspicious
- `POST /api/v1/security/detect` — Trigger manual re-check
- `GET /api/v1/security/alerts` — Paginated alerts
- `POST /api/v1/security/alerts/:id/acknowledge` — Mark as resolved
- Auto-lock account after N failed attempts

### Database

```sql
CREATE TABLE login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  location_city TEXT,
  location_country TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_login_attempts_user ON login_attempts (user_id, created_at DESC);
CREATE INDEX idx_login_attempts_ip ON login_attempts (ip_address);
```

---

## 2.9 User-Managed Recovery Key

**Concept:** Encrypted cloud backup with a printable 12-24 word recovery phrase (like crypto wallets).

### Frontend

- `features/recovery-key/`
  - `view/RecoveryKeyGenerateView.tsx` — Generate + display phrase
  - `view/RecoveryKeyConfirmView.tsx` — Verify by selecting words
  - `components/RecoveryKeyPrint.tsx` — Printable card
  - `components/RecoveryKeyWarning.tsx` — Safety disclaimer
- Recovery key used to derive encryption master key
- Without recovery key, encrypted data is unrecoverable
- Route: `/settings/security/recovery-key`

### Backend

- `POST /api/v1/auth/recovery-key/generate` — Generate key, store hash
- `POST /api/v1/auth/recovery-key/verify` — Verify phrase
- `POST /api/v1/auth/recovery-key/regenerate` — Regenerate (invalidates old)
- Key hashed with Argon2id before storage

### Database

```sql
ALTER TABLE profiles ADD COLUMN recovery_key_hash TEXT;
ALTER TABLE profiles ADD COLUMN recovery_key_salt TEXT;
ALTER TABLE profiles ADD COLUMN recovery_key_created_at TIMESTAMPTZ;
```

---

## 2.10 Per-Entry Privacy Levels

**Concept:** Each journal entry can be private, shared with trusted contacts, or public (for optional anonymous reflection sharing).

### Frontend

- `components/PrivacyLevelSelector.tsx` — Dropdown/radio: Private, Trusted Contacts Only, Anonymous Public
- Shown on journal create/edit form
- Privacy badge on journal cards in list view
- `model/journal.model.ts` — Add `privacy_level` field

### Backend

- `journal_entries.privacy_level` field (enum: `private`, `trusted_only`, `anonymous_public`)
- Service enforces access: `trusted_only` entries visible to user + trusted contacts
- `anonymous_public` entries stripped of user ID and PII before serving
- `GET /api/v1/journals/shared` — Get entries shared with current user as trusted contact
- `GET /api/v1/community/reflections` — Anonymous public entries (with consent)

### Database

```sql
CREATE TYPE privacy_level AS ENUM ('private', 'trusted_only', 'anonymous_public');

ALTER TABLE journal_entries
  ADD COLUMN privacy_level privacy_level NOT NULL DEFAULT 'private';
ALTER TABLE journal_entries
  ADD COLUMN is_anonymized BOOLEAN DEFAULT false;

-- RLS must be updated:
-- private: auth.uid() = user_id
-- trusted_only: auth.uid() = user_id OR auth.uid() IN (trusted_contacts of user_id)
-- anonymous_public: anyone can read (but without user_id linkage)

CREATE INDEX idx_journal_privacy ON journal_entries (privacy_level, created_at DESC);
```

---

# Part 3: Entertainment & Fun Features (10)

---

## 3.1 Journal Streak Badges

**Concept:** Achievement system for journaling consistency — badges for 3-day, 7-day, 30-day, 100-day, 365-day streaks.

### Frontend

- `features/achievements/`
  - `view/AchievementsView.tsx` — Gallery of earned/locked badges
  - `components/BadgeCard.tsx` — Badge icon, name, description, progress
  - `components/StreakCounter.tsx` — Current streak display
  - `view-model/useAchievementsViewModel.ts`
- Route: `/achievements` (protected)
- Badge unlock animation: gentle scale + glow (no confetti on crisis users)
- Badges appear on dashboard sidebar

### Backend

- `GET /api/v1/achievements` — List all achievements with earned status
- `POST /api/v1/achievements/check` — Force check for new unlocks
- `GET /api/v1/achievements/:id` — Single achievement detail
- Streak computed from `journal_entries` `created_at` date sequence

### Database

```sql
CREATE TYPE achievement_type AS ENUM (
  'first_entry', 'streak_3', 'streak_7', 'streak_30', 'streak_100', 'streak_365',
  'mood_checkin_7', 'grounding_7', 'buddy_first', 'entries_10', 'entries_50',
  'entries_100', 'reflection_master', 'emotional_awareness'
);

CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type achievement_type NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  progress INT DEFAULT 0,
  target INT DEFAULT 1,
  is_new BOOLEAN DEFAULT true,
  CONSTRAINT unique_user_achievement UNIQUE (user_id, achievement_type)
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their achievements"
  ON achievements FOR ALL
  USING (auth.uid() = user_id);
```

---

## 3.2 Monthly "ECHO Reflection"

**Concept:** Auto-generated monthly summary — like the weekly summary but monthly, with deeper trends and comparisons.

### Frontend

- Same component library as weekly summary but with monthly aggregation
- `view/MonthlyReflectionView.tsx` — Extended summary with trend comparisons vs last month
- Route: `/reflection/monthly` and modal pop on new month

### Backend

- Same service as weekly summaries with `interval = 'month'`
- `GET /api/v1/monthly-reflections/latest`
- `POST /api/v1/monthly-reflections/generate`
- `GET /api/v1/monthly-reflections/history`

### Database

Same schema as `weekly_summaries` but table: `monthly_reflections` with month_start/end.

```sql
CREATE TABLE monthly_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_start DATE NOT NULL,
  month_end DATE NOT NULL,
  total_entries INT NOT NULL DEFAULT 0,
  total_words INT NOT NULL DEFAULT 0,
  journal_streak_days INT NOT NULL DEFAULT 0,
  most_frequent_mood TEXT,
  top_emotions JSONB NOT NULL DEFAULT '[]'::jsonb,
  mood_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_insight TEXT,
  buddy_highlights JSONB DEFAULT '[]'::jsonb,
  comparison_to_last_month JSONB, -- {"entries_change": 15, "mood_shift": "improved"}
  model_version TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_month UNIQUE (user_id, month_start)
);

ALTER TABLE monthly_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their monthly reflections"
  ON monthly_reflections FOR ALL
  USING (auth.uid() = user_id);
```

---

## 3.3 Mood-Curated Music/Playlists

**Concept:** Suggest calming or uplifting music based on current mood via third-party API (Spotify, Apple Music).

### Frontend

- `features/mood-music/`
  - `view/MoodMusicView.tsx` — Music suggestions for current mood
  - `components/MusicSuggestionCard.tsx` — Track info, preview, platform link
  - `view-model/useMoodMusicViewModel.ts`
  - `model/mood-music.model.ts` — Track, Playlist interfaces
  - `services/mood-music.service.ts` — Third-party API integration
- Dashboard widget: "Music for your mood"
- Mood trigger: based on latest check-in or journal analysis
- Privacy: no listening history sent to server, music links open in new tab

### Backend

- `POST /api/v1/mood-music/suggest` — Accept `mood`, return curated playlist/tracks
- Integrates with Spotify API (playlist search by mood keyword)
- Backend caches results by mood for 24h

### Database

```sql
CREATE TABLE mood_music_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mood TEXT NOT NULL,
  tracks JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT unique_mood UNIQUE (mood)
);
```

---

## 3.4 Daily Affirmations

**Concept:** Mood-aware inspirational quotes that appear on dashboard and as push notifications.

### Frontend

- `features/affirmations/`
  - `components/AffirmationCard.tsx` — Quote with attribution, gentle animation
  - `components/AffirmationWidget.tsx` — Dashboard widget
  - `view-model/useAffirmationViewModel.ts`
- Mood-aware: if mood is "anxious", show calming affirmation; if "sad", show hopeful
- Curated library of 100+ affirmations (stored in DB), tagged per mood
- Option to favorite an affirmation

### Backend

- `GET /api/v1/affirmations/today` — Return daily affirmation (optional mood param)
- `POST /api/v1/affirmations/:id/favorite` — Save favorite
- `GET /api/v1/affirmations/favorites` — List favorites

### Database

```sql
CREATE TABLE affirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  attribution TEXT,
  target_moods TEXT[] NOT NULL DEFAULT '{}',
  category TEXT, -- 'calm', 'hope', 'strength', 'gratitude', 'courage'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_affirmation_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affirmation_id UUID NOT NULL REFERENCES affirmations(id) ON DELETE CASCADE,
  favorited_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_affirmation UNIQUE (user_id, affirmation_id)
);

ALTER TABLE user_affirmation_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their favorites"
  ON user_affirmation_favorites FOR ALL
  USING (auth.uid() = user_id);
```

---

## 3.5 Grounding Challenges

**Concept:** Gamified 7-day grounding exercise streaks with progress tracking and completion rewards.

### Frontend

- `features/grounding-challenges/`
  - `view/ChallengesView.tsx` — Active challenges list
  - `view/ChallengeDetailView.tsx` — Day-by-day progress
  - `components/ChallengeCard.tsx` — Challenge summary with progress bar
  - `components/DailyTaskCheckbox.tsx` — Mark daily exercise complete
  - `view-model/useChallengesViewModel.ts`
- Route: `/challenges` (protected)
- Challenges: "7 days of breathing", "5 days of 5-4-3-2-1", "Journal every day for a week"

### Backend

- `GET /api/v1/challenges` — List challenges (active + available)
- `POST /api/v1/challenges/enroll` — Enroll in a challenge
- `PATCH /api/v1/challenges/:id/progress` — Update daily progress
- `GET /api/v1/challenges/:id` — Single challenge detail with streak

### Database

```sql
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_days INT NOT NULL,
  exercise_type TEXT NOT NULL, -- 'breathing', 'sensory', 'journaling', 'mood_checkin'
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  progress INT DEFAULT 0,
  current_day INT DEFAULT 1,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'failed'
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT unique_user_challenge UNIQUE (user_id, challenge_id)
);

ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their challenges"
  ON user_challenges FOR ALL
  USING (auth.uid() = user_id);
```

---

## 3.6 Buddy Personality Customization

**Concept:** Users can customize Buddy's name, tone, avatar, and communication style.

### Frontend

- `features/buddy-customization/`
  - `view/BuddyCustomizationView.tsx` — Customization dashboard
  - `components/BuddyNameEditor.tsx`
  - `components/BuddyToneSelector.tsx` — Warm, Direct, Playful, Calm
  - `components/BuddyAvatarPicker.tsx` — Avatar options
- Route: `/settings/buddy`
- Preview pane shows real-time effect on sample message

### Backend

- `PATCH /api/v1/buddy/preferences` — Update Buddy personality settings
- `GET /api/v1/buddy/preferences` — Get current settings
- Tone selection injected into AI prompt as system message modifier

### Database

```sql
ALTER TABLE profiles ADD COLUMN buddy_name TEXT DEFAULT 'Buddy';
ALTER TABLE profiles ADD COLUMN buddy_tone TEXT DEFAULT 'warm';
ALTER TABLE profiles ADD COLUMN buddy_avatar TEXT DEFAULT 'default';
ALTER TABLE profiles ADD COLUMN buddy_voice TEXT;
```

---

## 3.7 Growth Garden

**Concept:** A virtual garden that grows as the user journals — each entry plants a seed that blooms over time.

### Frontend

- `features/growth-garden/`
  - `view/GrowthGardenView.tsx` — Full garden display
  - `components/GardenPlot.tsx` — Grid of plants
  - `components/PlantItem.tsx` — Single plant with growth stage (seed, sprout, bloom, tree)
  - `components/GardenStatSummary.tsx` — Total plants, garden level
  - `view-model/useGrowthGardenViewModel.ts`
- Route: `/garden` (protected)
- Plants tiered by entry count: first entry = seed, 3 = sprout, 7 = bloom, 30 = tree
- Seasonal themes (spring flowers, autumn leaves)
- Dashboard widget: small garden preview

### Backend

- `GET /api/v1/garden` — Get garden state
- `POST /api/v1/garden/water` — Water plants (engagement mechanic)
- `GET /api/v1/garden/plants` — List all plants with growth stages
- Garden state derived from journal entries (never stores PII)

### Database

```sql
CREATE TABLE garden_plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plant_type TEXT NOT NULL DEFAULT 'flower',
  growth_stage INT NOT NULL DEFAULT 1,
  planted_at TIMESTAMPTZ DEFAULT now(),
  last_watered_at TIMESTAMPTZ,
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  position_x INT NOT NULL,
  position_y INT NOT NULL
);

ALTER TABLE garden_plants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their garden"
  ON garden_plants FOR ALL
  USING (auth.uid() = user_id);

CREATE TABLE garden_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'spring',
  total_plants INT DEFAULT 0,
  garden_level INT DEFAULT 1,
  last_visit_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE garden_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their garden state"
  ON garden_state FOR ALL
  USING (auth.uid() = user_id);
```

---

## 3.8 Mood Weather Calendar

**Concept:** Visual heatmap/weather-style calendar showing daily moods — like GitHub contribution graph but for emotions.

### Frontend

- `features/mood-calendar/`
  - `view/MoodCalendarView.tsx` — Full year/month view
  - `components/MoodCalendarGrid.tsx` — Grid of colored cells
  - `components/MoodCalendarDay.tsx` — Single day with mood color + tooltip
  - `components/MoodLegend.tsx` — Mood-to-color mapping
  - `components/MoodMonthSelector.tsx` — Navigate months
  - `view-model/useMoodCalendarViewModel.ts`
- Route: `/insights/mood-calendar`
- Color gradient: calm=blue, happy=yellow, neutral=gray, sad=indigo, anxious=amber, angry=red
- Click day to see journal entry for that date

### Backend

- `GET /api/v1/mood-calendar/:year/:month` — Get mood data for month
- `GET /api/v1/mood-calendar/:year` — Get full year summary

### Database

No new table needed. Query from journal_entries and mood_checkins:
```sql
SELECT created_at::date, mood
FROM journal_entries
WHERE user_id = $1
  AND date_trunc('month', created_at) = date_trunc('month', $2::date)
  AND deleted_at IS NULL
ORDER BY created_at::date;
```

Index:
```sql
CREATE INDEX idx_journal_entries_user_date_mood
  ON journal_entries (user_id, (created_at::date), mood)
  WHERE deleted_at IS NULL;
```

---

## 3.9 Creative Writing Prompts

**Concept:** Optional storytelling or expressive writing mode with curated prompts for creativity and emotional exploration.

### Frontend

- `features/writing-prompts/`
  - `view/PromptSelectionView.tsx` — Browse prompts by category
  - `view/PromptWritingView.tsx` — Writing interface with prompt visible
  - `components/PromptCard.tsx` — Single prompt suggestion
  - `view-model/useWritingPromptsViewModel.ts`
- Route: `/journal/prompts`
- Integrates into journal editor: "Write with a prompt" toggle
- Categories: Gratitude, Reflection, Creative, Emotional Exploration, Future Self

### Backend

- `GET /api/v1/writing-prompts` — List prompts (filter by category)
- `GET /api/v1/writing-prompts/daily` — Get daily featured prompt
- `POST /api/v1/writing-prompts/:id/use` — Log that user used this prompt

### Database

```sql
CREATE TABLE writing_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  category TEXT NOT NULL, -- 'gratitude', 'reflection', 'creative', 'exploration', 'future'
  difficulty TEXT DEFAULT 'beginner',
  is_daily BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_prompt_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES writing_prompts(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_prompt_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their prompt usage"
  ON user_prompt_usage FOR ALL
  USING (auth.uid() = user_id);
```

---

## 3.10 Ambient Soundscapes

**Concept:** Built-in library of nature sounds, white noise, lo-fi music for focus, grounding, and relaxation.

### Frontend

- `features/soundscapes/`
  - `view/SoundscapesView.tsx` — Sound library browser
  - `components/SoundscapeCard.tsx` — Sound tile with play button
  - `components/AudioPlayer.tsx` — Minimal player with volume, timer
  - `components/SoundMixer.tsx` — Layer multiple sounds
  - `view-model/useSoundscapesViewModel.ts`
- Route: `/tools/soundscapes`
- Dashboard mini-player: persistent audio bar at bottom
- Sound categories: Nature (rain, ocean, forest), White Noise, Lo-fi, Binaural Beats
- Timer: 15/30/60 min auto-stop
- Integrates with grounding exercises: auto-start sound when beginning breathing

### Backend

- `GET /api/v1/soundscapes` — List available soundscapes
- `POST /api/v1/soundscapes/favorites` — Save favorites
- `GET /api/v1/soundscapes/favorites` — List favorites
- Sound files stored in Supabase Storage bucket (`soundscapes/`)

### Database

```sql
CREATE TABLE soundscapes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'nature', 'white_noise', 'lofi', 'binaural'
  duration_seconds INT NOT NULL,
  file_url TEXT NOT NULL,
  file_format TEXT DEFAULT 'mp3',
  thumbnail_url TEXT,
  is_premium BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_soundscape_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  soundscape_id UUID NOT NULL REFERENCES soundscapes(id) ON DELETE CASCADE,
  favorited_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_soundscape UNIQUE (user_id, soundscape_id)
);

ALTER TABLE user_soundscape_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their soundscape favorites"
  ON user_soundscape_favorites FOR ALL
  USING (auth.uid() = user_id);

CREATE TABLE user_soundscape_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  soundscape_id UUID NOT NULL REFERENCES soundscapes(id) ON DELETE CASCADE,
  listened_duration_seconds INT DEFAULT 0,
  played_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_soundscape_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their listening history"
  ON user_soundscape_history FOR ALL
  USING (auth.uid() = user_id);
```

---

# Part 4: Safety & Wellbeing Features (10)

---

## 4.1 Proactive Crisis Detection

**Concept:** Sentiment analysis triggers in-app check-in before crisis escalation — detects distress patterns early.

### Frontend

- `features/crisis-detection/`
  - `components/CrisisCheckInBanner.tsx` — Gentle check-in banner
  - `components/CrisisCheckInDialog.tsx` — "How are you feeling right now?" dialog
  - `view/CrisisCheckInView.tsx` — Full-page check-in
  - `view-model/useCrisisCheckInViewModel.ts`
- Trigger: AI analysis detects sustained negative sentiment or specific keywords
- Banner on dashboard: "We noticed things have been tough. Would you like to check in?"
- Options: grounding exercise, talk to Buddy, contact trusted person, crisis resources
- Non-intrusive — easy to dismiss, no alarmist language

### Backend

- `POST /api/v1/crisis/detect` — Run detection on recent entries
- `GET /api/v1/crisis/checkin-status` — Whether check-in is recommended
- `POST /api/v1/crisis/checkin-response` — Log user's check-in response
- Detection: running average of risk scores + keyword frequency

### Database

```sql
CREATE TABLE crisis_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  triggered_by TEXT NOT NULL, -- 'ai_detection', 'schedule', 'user_manual'
  user_response TEXT,         -- 'okay', 'struggling', 'need_help', 'dismissed'
  action_taken TEXT,          -- 'grounding', 'buddy', 'trusted_contact', 'crisis_resources', 'none'
  risk_score_at_time INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE crisis_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their checkins"
  ON crisis_checkins FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_crisis_checkins_user_date
  ON crisis_checkins (user_id, created_at DESC);
```

---

## 4.2 Wellness Routine Reminders

**Concept:** Track and remind about medication, hydration, meals, sleep, movement — holistic wellness beyond journaling.

### Frontend

- `features/wellness-routines/`
  - `view/RoutineListView.tsx` — View/manage routines
  - `view/RoutineEditorView.tsx` — Create/edit routine
  - `components/RoutineCard.tsx` — Single routine with streak
  - `components/RoutineReminderToggle.tsx` — Notification on/off
  - `view-model/useRoutineViewModel.ts`
- Route: `/settings/routines`
- Dashboard widget: "Today's routines" checklist
- Push notification reminders at configured times

### Backend

- `GET /api/v1/routines` — List user's routines
- `POST /api/v1/routines` — Create routine
- `PATCH /api/v1/routines/:id` — Update routine
- `DELETE /api/v1/routines/:id` — Delete routine
- `PATCH /api/v1/routines/:id/complete` — Mark today's task done
- `GET /api/v1/routines/today` — Get today's checklist

### Database

```sql
CREATE TABLE wellness_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'medication', 'hydration', 'movement', 'sleep', 'nutrition', 'self_care'
  frequency TEXT NOT NULL, -- 'daily', 'weekly', 'custom'
  custom_days INT[],      -- days of week (0=Sun, 6=Sat)
  reminder_time TIME,
  reminder_enabled BOOLEAN DEFAULT true,
  target_count INT DEFAULT 1,
  unit TEXT,               -- 'cups', 'minutes', 'times'
  current_streak INT DEFAULT 0,
  best_streak INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wellness_routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their routines"
  ON wellness_routines FOR ALL
  USING (auth.uid() = user_id);

CREATE TABLE routine_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES wellness_routines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

ALTER TABLE routine_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their completions"
  ON routine_completions FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_routine_completions_date
  ON routine_completions (user_id, routine_id, completed_at DESC);
```

---

## 4.3 Bedtime Reflection Mode

**Concept:** Evening wind-down prompt with gratitude focus — designed for use before sleep.

### Frontend

- `features/bedtime-reflection/`
  - `view/BedtimeReflectionView.tsx` — Full-page wind-down experience
  - `components/GratitudeInput.tsx` — "What are 3 things you're grateful for?"
  - `components/BedtimeSummary.tsx` — "Today in review" gentle recap
  - `components/BedtimeTimer.tsx` — Optional countdown to wind-down
  - `view-model/useBedtimeReflectionViewModel.ts`
- Route: `/reflection/bedtime`
- Auto-trigger: if user sets bedtime hours in settings, show reminder at configured time
- Dark, calm UI theme (automatic dark mode, dimmer colors)
- Prompts: "What went well today?", "What are you grateful for?", "Set an intention for tomorrow"
- Warning: if mood is very low, suggest crisis resources instead

### Backend

- `POST /api/v1/bedtime-reflection` — Save bedtime reflection entry
- `GET /api/v1/bedtime-reflection/today` — Check if already completed
- `GET /api/v1/bedtime-reflection/history` — Past reflections

### Database

```sql
CREATE TABLE bedtime_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gratitudes TEXT[],     -- 3 things grateful for
  highlight TEXT,        -- best moment of day
  intention TEXT,        -- intention for tomorrow
  mood_before TEXT,      -- mood before reflection
  mood_after TEXT,       -- mood after reflection (optional)
  soundscape_id UUID REFERENCES soundscapes(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bedtime_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their bedtime reflections"
  ON bedtime_reflections FOR ALL
  USING (auth.uid() = user_id);

ALTER TABLE notification_preferences ADD COLUMN bedtime_reminder BOOLEAN DEFAULT false;
ALTER TABLE notification_preferences ADD COLUMN bedtime_reminder_time TIME DEFAULT '21:00';
```

---

## 4.4 Trusted Circle Sharing

**Concept:** Selective sharing of mood summaries with pre-approved trusted contacts — with full consent control.

### Frontend

- `features/trusted-circle/`
  - `view/TrustedCircleView.tsx` — Manage circle members
  - `view/SharedMoodView.tsx` — What circle members see
  - `components/CircleMemberCard.tsx` — Member with sharing preferences
  - `components/ShareScopeSelector.tsx` — What to share (mood only / journal summary / nothing)
  - `view-model/useTrustedCircleViewModel.ts`
- Route: `/settings/trusted-circle` (extends trusted-contacts)
- Invite flow: send email/SMS link, recipient creates account or is notified
- Granular: share mood trends, weekly summaries, or crisis alerts only
- Consent required: both parties must agree

### Backend

- `GET /api/v1/trusted-circle` — List circle members with permissions
- `POST /api/v1/trusted-circle/invite` — Send invitation
- `PATCH /api/v1/trusted-circle/:id` — Update sharing scope
- `DELETE /api/v1/trusted-circle/:id` — Remove member
- `GET /api/v1/trusted-circle/shared-data` — What I can see from my circle
- `POST /api/v1/trusted-circle/:id/consent` — Accept/decline invitation

### Database

```sql
CREATE TYPE sharing_scope AS ENUM (
  'crisis_only',
  'mood_summary',
  'weekly_summary',
  'journal_titles',
  'full_access'
);

ALTER TABLE trusted_contacts
  ADD COLUMN sharing_scope sharing_scope NOT NULL DEFAULT 'crisis_only';
ALTER TABLE trusted_contacts
  ADD COLUMN is_circle_member BOOLEAN DEFAULT false;
ALTER TABLE trusted_contacts
  ADD COLUMN invited_at TIMESTAMPTZ;
ALTER TABLE trusted_contacts
  ADD COLUMN consented_at TIMESTAMPTZ;

CREATE TABLE circle_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sharing_scope sharing_scope NOT NULL DEFAULT 'crisis_only',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_share_pair UNIQUE (owner_id, viewer_id)
);

ALTER TABLE circle_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage shares"
  ON circle_shares FOR ALL
  USING (auth.uid() = owner_id);
CREATE POLICY "Viewers read shares"
  ON circle_shares FOR SELECT
  USING (auth.uid() = viewer_id);
```

---

## 4.5 Prolonged Low-Sentiment Alert

**Concept:** Warning after consecutive days of negative mood/journal patterns — gentle awareness, not alarm.

### Frontend

- `features/wellbeing-alerts/`
  - `components/LowSentimentBanner.tsx` — Non-alarming awareness banner
  - `components/WellbeingTrendGraph.tsx` — 7/14/30 day trend
  - `view-model/useWellbeingAlertsViewModel.ts`
- Banner text: "We've noticed you've been feeling [mood] for a few days. Would you like to explore some supportive resources?"
- Easily dismissible, does not re-trigger for 24h after dismissal

### Backend

- `GET /api/v1/wellbeing/alerts` — Current alert status
- `POST /api/v1/wellbeing/alerts/:id/dismiss` — Dismiss alert
- Detection: running 5-day mood average, if below threshold for 3+ days => alert

### Database

```sql
CREATE TABLE wellbeing_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'low_mood', 'declining_trend', 'inconsistent_engagement'
  severity TEXT NOT NULL DEFAULT 'info', -- 'info', 'gentle', 'support'
  message TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wellbeing_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their wellbeing alerts"
  ON wellbeing_alerts FOR ALL
  USING (auth.uid() = user_id);
```

---

## 4.6 Daily Wellbeing Score

**Concept:** Algorithmic daily score (0-100) with actionable improvement tips — non-clinical, non-diagnostic.

### Frontend

- `features/wellbeing-score/`
  - `components/WellbeingScoreWidget.tsx` — Dashboard widget showing score + trend arrow
  - `components/ScoreBreakdown.tsx` — Factors contributing to score
  - `components/ScoreTipCard.tsx` — Actionable tip to improve
  - `view/WellbeingScoreView.tsx` — Full page with history chart
  - `view-model/useWellbeingScoreViewModel.ts`
- Score factors: mood, journaling consistency, sleep, grounding usage, Buddy interactions
- Always shows uncertainty: "This is an automated estimate, not a clinical measure"
- Route: `/insights/wellbeing-score`

### Backend

- `POST /api/v1/wellbeing/score/compute` — Recompute today's score
- `GET /api/v1/wellbeing/score/today` — Get today's score
- `GET /api/v1/wellbeing/score/history` — Score trend over time
- `GET /api/v1/wellbeing/score/tips` — Curated tips based on score factors
- Computation: weighted average of mood (40%), consistency (25%), engagement (20%), routine adherence (15%)

### Database

```sql
CREATE TABLE wellbeing_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 0 AND score <= 100),
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {"mood": 75, "consistency": 60, "engagement": 80, "routines": 50}
  tip_generated TEXT,
  score_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_score_date UNIQUE (user_id, score_date)
);

ALTER TABLE wellbeing_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their scores"
  ON wellbeing_scores FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_wellbeing_scores_user_date
  ON wellbeing_scores (user_id, score_date DESC);
```

---

## 4.7 Mindfulness Bell

**Concept:** Configurable gentle bell/chime reminders throughout the day for mindfulness pauses.

### Frontend

- `features/mindfulness-bell/`
  - `components/BellScheduleEditor.tsx` — Set reminder times
  - `components/BellSoundSelector.tsx` — Choose chime sound
  - `components/MindfulnessPrompt.tsx` — Brief prompt on bell ring
  - `view-model/useMindfulnessBellViewModel.ts`
- Route: `/settings/mindfulness-bell`
- Pre-built schedules: "Every hour", "3x daily (morning/noon/evening)", "Custom"
- Bell sounds: soft chime, singing bowl, wind chime, gentle gong
- On bell: brief notification with 5-second breathing prompt
- Respects quiet hours

### Backend

- `PATCH /api/v1/settings/mindfulness-bell` — Save bell preferences
- `GET /api/v1/settings/mindfulness-bell` — Get current settings
- Notification scheduling handled client-side (Service Worker) for offline reliability

### Database

```sql
ALTER TABLE notification_preferences ADD COLUMN mindfulness_bell_enabled BOOLEAN DEFAULT false;
ALTER TABLE notification_preferences ADD COLUMN mindfulness_bell_schedule TEXT[] DEFAULT '{}';
ALTER TABLE notification_preferences ADD COLUMN mindfulness_bell_sound TEXT DEFAULT 'soft_chime';
```

---

## 4.8 Provider Report Generator

**Concept:** Consent-based summary PDF for therapists or doctors — share insights with healthcare providers.

### Frontend

- `features/provider-reports/`
  - `view/ReportGeneratorView.tsx` — Configure and generate report
  - `components/ReportSectionSelector.tsx` — Choose what to include
  - `components/ReportPreview.tsx` — Preview before generating
  - `components/ReportShareDialog.tsx` — Download or share securely
  - `view-model/useProviderReportViewModel.ts`
- Route: `/settings/provider-reports`
- Sections: mood trends (3 months), journal frequency, risk signals, grounding usage
- Always includes disclaimer: "This report is generated from self-reported data and is not a clinical assessment"
- Format: PDF, encrypted with patient-provided password
- Option: generate secure share link that expires after 7 days

### Backend

- `POST /api/v1/provider-reports/generate` — Generate report PDF
- `GET /api/v1/provider-reports/:id/download` — Download report
- `POST /api/v1/provider-reports/:id/share` — Create secure share link
- `GET /api/v1/provider-reports/shared/:token` — Access shared report (token-based)
- `DELETE /api/v1/provider-reports/:id` — Delete report
- Report generation: aggregate data, compile PDF, encrypt, store in Supabase Storage

### Database

```sql
CREATE TABLE provider_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  file_url TEXT,
  file_size_bytes INT,
  is_encrypted BOOLEAN DEFAULT true,
  share_token TEXT UNIQUE,
  share_expires_at TIMESTAMPTZ,
  download_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE provider_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their reports"
  ON provider_reports FOR ALL
  USING (auth.uid() = user_id);
```

---

## 4.9 Emergency Auto-Notify

**Concept:** If crisis level escalates and user is unresponsive to in-app check-ins, automatically notify pre-approved trusted contact.

### Frontend

- `features/emergency-notify/`
  - `view/EmergencyNotifySetup.tsx` — Configure emergency contacts
  - `components/EmergencyContactList.tsx` — Priority-ordered contacts
  - `components/EmergencyCountdown.tsx` — 60-second cancel countdown before notify
  - `view-model/useEmergencyNotifyViewModel.ts`
- Route: `/settings/emergency-notify`
- Flow:
  1. Crisis detection triggers check-in
  2. If user dismisses 3 check-ins in 1 hour => escalation
  3. 60-second countdown: "We'll notify [contact name] in 60 seconds unless you cancel"
  4. User can cancel, or text/call contact themselves
  5. Auto-notify sends SMS/email with: "[User] may need support."
- No clinical details shared — just "they may need support"
- Requires explicit opt-in consent with acknowledgment

### Backend

- `POST /api/v1/emergency/configure` — Save emergency configuration
- `GET /api/v1/emergency/status` — Current escalation status
- `POST /api/v1/emergency/cancel` — Cancel pending notification
- `POST /api/v1/emergency/trigger` — Manual trigger
- Notification dispatch via Twilio (SMS) and/or SendGrid (email)
- Rate-limited: max 1 emergency notification per 24h per contact

### Database

```sql
CREATE TABLE emergency_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  auto_notify_after_minutes INT DEFAULT 30,
  max_checkins_before_escalation INT DEFAULT 3,
  cooldown_hours INT DEFAULT 24,
  consent_acknowledged_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE emergency_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their emergency config"
  ON emergency_config FOR ALL
  USING (auth.uid() = user_id);

ALTER TABLE trusted_contacts ADD COLUMN is_emergency_contact BOOLEAN DEFAULT false;
ALTER TABLE trusted_contacts ADD COLUMN emergency_priority INT DEFAULT 1;

CREATE TABLE emergency_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES trusted_contacts(id) ON DELETE CASCADE,
  triggered_by TEXT NOT NULL, -- 'auto_detection', 'user_manual'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'cancelled', 'failed'
  cancelled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivery_method TEXT, -- 'sms', 'email', 'push'
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE emergency_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their emergency notifications"
  ON emergency_notifications FOR SELECT
  USING (auth.uid() = user_id);
```

---

## 4.10 Context-Aware Grounding Suggestions

**Concept:** Suggest specific grounding exercise based on detected emotion — e.g., box breathing for anxiety, 5-4-3-2-1 for panic.

### Frontend

- `features/smart-grounding/`
  - `view/SmartGroundingView.tsx` — Emotion-triggered exercise suggestion
  - `components/GroundingSuggestionCard.tsx` — Exercise card with "why this helps"
  - `components/MoodToExerciseMapper.tsx` — Visual mapping
  - `view-model/useSmartGroundingViewModel.ts`
- Dashboard widget: "Based on your current mood, try..."
- Triggered by: mood check-in result, journal analysis emotion, or manual
- Suggestions:
  - Anxiety => Box breathing (4-4-4-4)
  - Panic => 5-4-3-2-1 sensory
  - Sadness => Gratitude reflection
  - Anger => Progressive muscle relaxation
  - Joy => Mindful appreciation (savoring)
  - Neutral => Body scan or mindful breathing
- After exercise: brief check-in "How do you feel now?" to track effectiveness

### Backend

- `GET /api/v1/grounding/suggestions` — Get suggestion for given emotion/mood
- `POST /api/v1/grounding/suggestions/effectiveness` — Log how user felt after
- `GET /api/v1/grounding/suggestions/user-preferences` — Which exercises work best for user

### Database

```sql
CREATE TABLE grounding_mood_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mood TEXT NOT NULL,
  exercise_type TEXT NOT NULL,
  priority INT DEFAULT 1,
  reasoning TEXT,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO grounding_mood_mapping (mood, exercise_type, priority, reasoning) VALUES
  ('anxious', 'box_breathing', 1, 'Box breathing activates the parasympathetic nervous system'),
  ('anxious', 'sensory_54321', 2, 'Sensory grounding redirects focus from internal worry to external environment'),
  ('panic', 'sensory_54321', 1, 'The 5-4-3-2-1 technique anchors attention to immediate surroundings'),
  ('sad', 'gratitude', 1, 'Gratitude reflection shifts cognitive focus towards positive aspects'),
  ('angry', 'pmr', 1, 'Progressive muscle relaxation releases physical tension'),
  ('joy', 'mindful_appreciation', 1, 'Mindful appreciation deepens positive emotions'),
  ('neutral', 'body_scan', 1, 'Body scan builds interoceptive awareness and connection');

CREATE TABLE user_grounding_effectiveness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_type TEXT NOT NULL,
  mood_before TEXT NOT NULL,
  mood_after TEXT NOT NULL,
  effectiveness_score INT CHECK (effectiveness_score >= 1 AND effectiveness_score <= 5),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_grounding_effectiveness ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their effectiveness data"
  ON user_grounding_effectiveness FOR ALL
  USING (auth.uid() = user_id);
```

---

# Part 5: New Routes Index

Add to `frontend/src/config/routes.config.ts`:

```ts
export const ROUTES = {
  // Existing routes preserved...

  // === SECTION 1: Weekly Summary ===
  summaryWeekly: "/summary/weekly",

  // === SECTION 2: Security ===
  securityAlerts: "/settings/security/alerts",
  twoFactor: "/settings/security/two-factor",
  biometricSetup: "/settings/security/biometric",
  recoveryKey: "/settings/security/recovery-key",
  sessions: "/settings/security/sessions",

  // === SECTION 3: Entertainment ===
  achievements: "/achievements",
  reflectionMonthly: "/reflection/monthly",
  moodMusic: "/tools/mood-music",
  challenges: "/challenges",
  garden: "/garden",
  moodCalendar: "/insights/mood-calendar",
  journalPrompts: "/journal/prompts",
  soundscapes: "/tools/soundscapes",
  buddyCustomization: "/settings/buddy",

  // === SECTION 4: Safety ===
  crisisCheckIn: "/crisis/check-in",
  routines: "/settings/routines",
  bedtimeReflection: "/reflection/bedtime",
  trustedCircle: "/settings/trusted-circle",
  wellbeingScore: "/insights/wellbeing-score",
  mindfulnessBell: "/settings/mindfulness-bell",
  providerReports: "/settings/provider-reports",
  emergencyNotify: "/settings/emergency-notify",
  smartGrounding: "/tools/smart-grounding",
} as const;
```

---

# Part 6: Implementation Phases

## Phase 1: Foundation (Week 1-2)
- Database migrations for all 31 features
- Shared UI components (new primitives if needed)
- Route registration

## Phase 2: Weekly Summary (Week 3-4)
- Full frontend + backend + AI integration
- Dashboard pop-up trigger logic
- Share card generation

## Phase 3: Security (Week 5-8)
- Biometric, 2FA, PIN, session management
- Login alerts, suspicious detection
- Encryption, recovery keys, privacy levels

## Phase 4: Safety & Wellbeing (Week 9-12)
- Crisis detection, emergency auto-notify
- Wellness routines, bedtime reflection
- Wellbeing score, provider reports
- Context-aware grounding

## Phase 5: Entertainment (Week 13-16)
- Achievements, growth garden
- Mood calendar, music, soundscapes
- Writing prompts, buddy customization
- Grounding challenges, affirmations

## Phase 6: Polish & Testing (Week 17-18)
- Cross-feature integration
- Accessibility audit
- Performance optimization
- End-to-end testing
- Documentation

---

# Part 7: Definition of Done

Each feature is complete when:

1. **Frontend:**
   - Follows MVVM pattern (Model, ViewModel, View, Service)
   - All states handled: loading, empty, error, success
   - Responsive (mobile, tablet, desktop)
   - Dark/light mode compatible
   - Accessibility: keyboard nav, screen reader, focus management
   - Respects `prefers-reduced-motion`
   - Linting + typechecking pass

2. **Backend:**
   - API endpoints return standardized responses
   - Zod validation on all inputs
   - RLS policies on all new tables
   - Bearer token authentication
   - No sensitive data logged
   - Unit tests pass

3. **Database:**
   - Migration is additive (no destructive changes to existing tables)
   - RLS enabled on every user-owned table
   - Indexes on all query paths
   - Constraints enforce data integrity

4. **AI Service (where applicable):**
   - Endpoint added to FastAPI
   - Response validated by backend Zod schema
   - No journal text persisted
   - Model version tracked in response

5. **Integration:**
   - Frontend HTTP adapter connects to real backend
   - Mock adapter maintained for development
   - Service factory toggles between mock/HTTP
   - Feature flag supports gradual rollout