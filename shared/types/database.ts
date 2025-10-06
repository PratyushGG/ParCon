export type Parent = {
  id: string
  email: string
  created_at: string
  updated_at: string
}

export type Child = {
  id: string
  parent_id: string
  name: string
  age: number
  youtube_channel_id: string | null
  youtube_access_token: string | null
  youtube_refresh_token: string | null
  token_expires_at: string | null
  created_at: string
  updated_at: string
}

export type ParentPreferences = {
  id: string
  parent_id: string
  allowed_topics: string[]
  blocked_topics: string[]
  allow_mild_language: boolean
  educational_priority: 'high' | 'medium' | 'low'
  created_at: string
  updated_at: string
}

export type Video = {
  id: string
  child_id: string
  youtube_video_id: string
  title: string | null
  channel_name: string | null
  channel_id: string | null
  description: string | null
  thumbnail_url: string | null
  duration: number | null
  watched_at: string | null
  has_transcript: boolean
  transcript_fetch_failed: boolean
  ai_decision: 'ALLOW' | 'REVIEW' | 'BLOCK' | null
  ai_confidence: number | null
  ai_category: string | null
  educational_value: number | null
  concerns: string[] | null
  ai_reasoning: string | null
  analyzed_at: string | null
  created_at: string
}

export type Channel = {
  id: string
  youtube_channel_id: string
  channel_name: string | null
  videos_analyzed: number
  trust_score: number | null
  is_whitelisted: boolean
  is_blacklisted: boolean
  parent_id: string | null
  created_at: string
  updated_at: string
}

export type Notification = {
  id: string
  parent_id: string
  type: string | null
  title: string | null
  message: string | null
  is_read: boolean
  created_at: string
}

export type UsageStats = {
  id: string
  parent_id: string
  date: string
  videos_analyzed: number
  ai_api_calls: number
  ai_tokens_used: number
  youtube_api_calls: number
  created_at: string
}
