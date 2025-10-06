# YouTube Parental Control - Backend PRDs

This directory contains comprehensive Product Requirement Documents (PRDs) for building the backend architecture of the YouTube Parental Control application.

## 📋 PRD Overview

### [PRD-01: YouTube OAuth Integration](./prd-01-youtube-oauth.md)
**Purpose**: Connect child's YouTube account via Google OAuth 2.0

**Key Features**:
- OAuth 2.0 authorization flow
- Token storage and refresh management
- Secure state parameter handling
- YouTube channel ID retrieval

**API Endpoints**:
- `GET /api/youtube/auth` - Initiate OAuth
- `GET /api/youtube/callback` - Handle callback
- `POST /api/youtube/disconnect` - Remove connection

**Estimated Time**: 4-6 hours

---

### [PRD-02: Watch History API](./prd-02-watch-history-api.md)
**Purpose**: Fetch and store YouTube watch history

**Key Features**:
- Fetch last 50 videos from YouTube Data API v3
- Store video metadata in database
- Handle duplicates with upsert logic
- Video listing with filtering/sorting

**API Endpoints**:
- `POST /api/videos/fetch` - Fetch watch history
- `GET /api/videos/list` - List videos with filters
- `GET /api/videos/[videoId]` - Get video details

**Estimated Time**: 6-8 hours

---

### [PRD-03: AI Video Analysis](./prd-03-ai-analysis.md)
**Purpose**: Analyze video content using AI (Claude/OpenAI)

**Key Features**:
- Fetch video transcripts
- AI-powered content analysis
- Decision engine (ALLOW/REVIEW/BLOCK)
- Confidence scoring and reasoning
- Parent preference integration

**API Endpoints**:
- `POST /api/analyze/video` - Analyze single video
- `POST /api/analyze/batch` - Batch analysis

**AI Models**:
- Primary: Claude 3.5 Sonnet
- Fallback: GPT-4o-mini

**Estimated Time**: 10-12 hours

---

### [PRD-04: Dashboard Updates](./prd-04-dashboard-updates.md)
**Purpose**: Display analyzed videos with interactive UI

**Key Features**:
- Children cards with stats
- Video list with filtering
- Video detail modal
- Manual decision overrides
- Channel whitelist/blacklist

**Pages to Build**:
- `/app/dashboard/page.tsx` (update)
- `/app/dashboard/[childId]/videos/page.tsx` (new)
- `/app/dashboard/[childId]/channels/page.tsx` (new)

**Components**:
- Video cards with AI decisions
- Filters and search
- Detail modals
- Channel management

**Estimated Time**: 8-10 hours

---

### [PRD-05: Background Jobs](./prd-05-background-jobs.md)
**Purpose**: Automate watch history sync and video analysis

**Key Features**:
- Periodic watch history sync (every 30 min)
- Queued video analysis (every 5 min)
- Channel trust score updates (every 6 hours)
- Usage stats aggregation (daily)
- Data cleanup (weekly)

**Technology Options**:
- **Vercel Cron** (simple, free tier)
- **Inngest** (recommended for production)

**Jobs**:
1. Sync Watch History
2. Analyze Videos
3. Update Trust Scores
4. Aggregate Stats
5. Cleanup Old Data

**Estimated Time**: 6-8 hours

---

### [PRD-06: Notifications](./prd-06-notifications.md)
**Purpose**: Alert parents about videos needing review

**Key Features**:
- In-app notifications with badge
- Notification types (REVIEW, BLOCK, expired tokens)
- Mark as read/unread
- Weekly summary digest
- Optional email notifications

**API Endpoints**:
- `GET /api/notifications/list` - Get notifications
- `POST /api/notifications/[id]/read` - Mark as read
- `POST /api/notifications/mark-all-read` - Mark all
- `DELETE /api/notifications/delete` - Delete

**Components**:
- Notification bell in header
- Dropdown notification list
- Full notifications page

**Estimated Time**: 4-6 hours

---

## 🎯 Implementation Roadmap

### Phase 1: Core Integration (Week 1)
1. **YouTube OAuth** (PRD-01) - 4-6 hours
2. **Watch History API** (PRD-02) - 6-8 hours
3. **AI Analysis** (PRD-03) - 10-12 hours

**Total**: ~20-26 hours

---

### Phase 2: User Interface (Week 2)
4. **Dashboard Updates** (PRD-04) - 8-10 hours
5. **Notifications** (PRD-06) - 4-6 hours

**Total**: ~12-16 hours

---

### Phase 3: Automation (Week 3)
6. **Background Jobs** (PRD-05) - 6-8 hours
7. Testing & Bug Fixes - 8-10 hours

**Total**: ~14-18 hours

---

## 📦 Technology Stack

### Backend
- **Next.js 15** - API Routes
- **Supabase** - Database + Auth + RLS
- **YouTube Data API v3** - Watch history
- **Anthropic Claude** - AI analysis (primary)
- **OpenAI GPT-4o-mini** - AI analysis (fallback)

### Background Jobs
- **Vercel Cron** - Simple scheduled jobs (MVP)
- **Inngest** - Advanced job orchestration (production)

### Notifications
- **Polling** - Every 30s (MVP)
- **Resend** - Email service (optional)

---

## 🔑 Environment Variables Needed

```env
# Google OAuth & YouTube
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
YOUTUBE_API_KEY=

# AI Providers
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Supabase (already have)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Background Jobs
CRON_SECRET=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Email (optional)
RESEND_API_KEY=

# Security
OAUTH_STATE_SECRET=
```

---

## 📊 Database Schema Updates

### New Columns to Add

**videos table**:
```sql
ALTER TABLE videos ADD COLUMN analysis_queued BOOLEAN DEFAULT FALSE;
ALTER TABLE videos ADD COLUMN analysis_priority INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN parent_override BOOLEAN DEFAULT FALSE;
CREATE INDEX idx_videos_queued ON videos(analysis_queued, analysis_priority DESC);
```

**notifications table**:
```sql
ALTER TABLE notifications ADD COLUMN action_url TEXT;
ALTER TABLE notifications ADD COLUMN priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE notifications ADD COLUMN metadata JSONB;
```

---

## 🧪 Testing Strategy

### Unit Tests
- YouTube API service functions
- AI prompt generation
- Token refresh logic
- Notification creation

### Integration Tests
- OAuth flow end-to-end
- Video fetch and analysis pipeline
- Background job execution
- Notification delivery

### E2E Tests
- Complete user journey
- Multi-child scenarios
- Error recovery

---

## 💰 Cost Estimates (per 50 videos)

| Service | Cost |
|---------|------|
| YouTube Data API | Free (within quota) |
| Claude 3.5 Sonnet | ~$0.15 |
| GPT-4o-mini | ~$0.01 |
| Supabase | Free tier OK for MVP |
| Vercel | Free tier OK for MVP |

**Total per child per month**: ~$2-5 (depending on viewing habits)

---

## 🚀 Next Steps

1. **Review all PRDs** - Make sure requirements align with vision
2. **Set up Google Cloud Console** - OAuth credentials
3. **Get AI API keys** - Anthropic and/or OpenAI
4. **Start with PRD-01** - YouTube OAuth integration
5. **Test incrementally** - After each PRD completion

---

## 📝 Notes

- All PRDs are designed to work together sequentially
- Database schema is already in place from initial migration
- Frontend structure exists, just needs enhancement
- Each PRD includes testing checklists
- Error handling is emphasized throughout
- Security best practices are documented

---

## 🤝 Questions or Clarifications?

Review each PRD and provide feedback on:
- Missing features
- Unclear requirements
- Technical concerns
- Timeline adjustments
- Alternative approaches

Once approved, implementation can begin!
