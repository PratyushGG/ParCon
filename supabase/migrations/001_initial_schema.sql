-- YouTube Parental Control - Initial Database Schema
-- Based on MVP-Tech-Spec_UPDATED.md

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- PARENTS TABLE
-- ========================================
CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Note: Passwords handled by Supabase Auth, not stored here

-- ========================================
-- CHILDREN TABLE
-- ========================================
CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  age INTEGER NOT NULL,
  youtube_channel_id VARCHAR(255),
  youtube_access_token TEXT,
  youtube_refresh_token TEXT,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_age CHECK (age >= 1 AND age <= 18)
);

-- ========================================
-- PARENT PREFERENCES TABLE
-- ========================================
CREATE TABLE parent_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
  allowed_topics TEXT[],
  blocked_topics TEXT[],
  allow_mild_language BOOLEAN DEFAULT false,
  educational_priority VARCHAR(20) DEFAULT 'high',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_parent_prefs UNIQUE(parent_id)
);

-- ========================================
-- VIDEOS TABLE
-- ========================================
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  youtube_video_id VARCHAR(50) NOT NULL,
  title TEXT,
  channel_name VARCHAR(255),
  channel_id VARCHAR(255),
  description TEXT,
  thumbnail_url TEXT,
  duration INTEGER,
  watched_at TIMESTAMP,

  -- AI Analysis Results
  has_transcript BOOLEAN DEFAULT false,
  transcript_fetch_failed BOOLEAN DEFAULT false,
  ai_decision VARCHAR(20),
  ai_confidence INTEGER,
  ai_category VARCHAR(50),
  educational_value INTEGER,
  concerns TEXT[],
  ai_reasoning TEXT,

  analyzed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_video_per_child UNIQUE(child_id, youtube_video_id),
  CONSTRAINT valid_confidence CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
  CONSTRAINT valid_educational_value CHECK (educational_value >= 0 AND educational_value <= 10)
);

-- Create indexes for better query performance
CREATE INDEX idx_videos_watched_at ON videos(child_id, watched_at DESC);
CREATE INDEX idx_videos_channel_id ON videos(channel_id);
CREATE INDEX idx_videos_decision ON videos(child_id, ai_decision);

-- ========================================
-- CHANNELS TABLE
-- ========================================
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  youtube_channel_id VARCHAR(255) NOT NULL,
  channel_name VARCHAR(255),
  videos_analyzed INTEGER DEFAULT 0,
  trust_score DECIMAL(3,2),
  is_whitelisted BOOLEAN DEFAULT false,
  is_blacklisted BOOLEAN DEFAULT false,
  parent_id UUID REFERENCES parents(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_channel_per_parent UNIQUE(youtube_channel_id, parent_id),
  CONSTRAINT valid_trust_score CHECK (trust_score >= 0 AND trust_score <= 1)
);

CREATE INDEX idx_channels_youtube_id ON channels(youtube_channel_id);

-- ========================================
-- NOTIFICATIONS TABLE
-- ========================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
  type VARCHAR(50),
  title VARCHAR(255),
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_unread ON notifications(parent_id, is_read, created_at DESC);

-- ========================================
-- USAGE STATS TABLE (Cost Tracking)
-- ========================================
CREATE TABLE usage_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  videos_analyzed INTEGER DEFAULT 0,
  ai_api_calls INTEGER DEFAULT 0,
  ai_tokens_used INTEGER DEFAULT 0,
  youtube_api_calls INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_stats_per_day UNIQUE(parent_id, date)
);

-- ========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================

-- Enable RLS on all tables
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;

-- Children policies
CREATE POLICY "Parents can view own children"
ON children FOR SELECT
USING (auth.uid() = parent_id);

CREATE POLICY "Parents can insert own children"
ON children FOR INSERT
WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Parents can update own children"
ON children FOR UPDATE
USING (auth.uid() = parent_id);

CREATE POLICY "Parents can delete own children"
ON children FOR DELETE
USING (auth.uid() = parent_id);

-- Videos policies
CREATE POLICY "Parents can view own children's videos"
ON videos FOR SELECT
USING (
  child_id IN (
    SELECT id FROM children WHERE parent_id = auth.uid()
  )
);

CREATE POLICY "Service can insert videos"
ON videos FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update videos"
ON videos FOR UPDATE
USING (true);

-- Channels policies
CREATE POLICY "Parents can view own channels"
ON channels FOR SELECT
USING (parent_id = auth.uid());

CREATE POLICY "Parents can insert own channels"
ON channels FOR INSERT
WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Parents can update own channels"
ON channels FOR UPDATE
USING (parent_id = auth.uid());

-- Parent preferences policies
CREATE POLICY "Parents can view own preferences"
ON parent_preferences FOR SELECT
USING (parent_id = auth.uid());

CREATE POLICY "Parents can insert own preferences"
ON parent_preferences FOR INSERT
WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Parents can update own preferences"
ON parent_preferences FOR UPDATE
USING (parent_id = auth.uid());

-- Notifications policies
CREATE POLICY "Parents can view own notifications"
ON notifications FOR SELECT
USING (parent_id = auth.uid());

CREATE POLICY "Service can insert notifications"
ON notifications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Parents can update own notifications"
ON notifications FOR UPDATE
USING (parent_id = auth.uid());

-- Usage stats policies--------------------------------
CREATE POLICY "Parents can view own usage stats"
ON usage_stats FOR SELECT
USING (parent_id = auth.uid());

CREATE POLICY "Service can insert usage stats"
ON usage_stats FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update usage stats"
ON usage_stats FOR UPDATE
USING (true);

