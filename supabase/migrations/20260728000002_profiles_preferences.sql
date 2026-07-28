ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS goals TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS buddy_tone_preference TEXT DEFAULT 'gentle',
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_reminder BOOLEAN DEFAULT true,
  weekly_report BOOLEAN DEFAULT true,
  buddy_messages BOOLEAN DEFAULT true,
  crisis_alert BOOLEAN DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trusted_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  relationship TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  camera_enabled BOOLEAN DEFAULT false,
  camera_interval_minutes INTEGER DEFAULT 30,
  facial_analysis_consent BOOLEAN DEFAULT false,
  theme_variant TEXT DEFAULT 'indigo',
  theme_mode TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_own_notification_preferences ON notification_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY insert_own_notification_preferences ON notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_own_notification_preferences ON notification_preferences FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY select_own_trusted_contacts ON trusted_contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY insert_own_trusted_contacts ON trusted_contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY delete_own_trusted_contacts ON trusted_contacts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY select_own_user_preferences ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY insert_own_user_preferences ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_own_user_preferences ON user_preferences FOR UPDATE USING (auth.uid() = user_id);
