# PRD-05: Background Jobs & Periodic Sync

## Overview
Implement background workers to automatically sync YouTube watch history, analyze new videos, update channel trust scores, and maintain system health without manual intervention.

## Goals
1. Keep watch history up-to-date automatically
2. Analyze new videos as they're discovered
3. Calculate and update channel trust scores
4. Track usage statistics for cost management
5. Clean up old data periodically

---

## Background Job Options

### Option 1: Vercel Cron Jobs (Recommended for MVP)

**Pros**:
- Native to Vercel/Next.js
- Free tier available
- Easy setup
- Serverless (no infrastructure management)

**Cons**:
- Limited to 1-minute intervals on paid plans
- 10-second timeout on Hobby plan
- Not suitable for long-running tasks

**Use Case**: Best for simple, quick tasks (< 10 seconds)

---

### Option 2: Inngest (Recommended for Production)

**Pros**:
- Purpose-built for Next.js
- Handles long-running jobs
- Built-in retries and error handling
- Job queuing and fan-out
- Free tier: 1M steps/month

**Cons**:
- Additional service dependency
- Slight learning curve

**Use Case**: Complex workflows, batch processing, reliability

---

### Option 3: Supabase Edge Functions + pg_cron

**Pros**:
- Integrated with Supabase
- Direct database access
- PostgreSQL-native scheduling

**Cons**:
- Requires Supabase Pro plan for pg_cron
- More complex setup

---

## Jobs to Implement

### 1. Sync Watch History Job

**Frequency**: Every 30 minutes
**Timeout**: 60 seconds
**Purpose**: Fetch new videos from YouTube for all connected children

**Logic**:
```typescript
export async function syncWatchHistory() {
  const { data: children } = await supabase
    .from('children')
    .select('id, parent_id, youtube_access_token')
    .not('youtube_access_token', 'is', null)
  
  for (const child of children) {
    try {
      const accessToken = await getValidAccessToken(child.id)
      
      const lastSyncTime = await getLastSyncTime(child.id)
      
      const newVideos = await fetchWatchHistorySince(accessToken, lastSyncTime)
      
      if (newVideos.length > 0) {
        await storeVideos(child.id, newVideos)
        
        await queueVideosForAnalysis(newVideos.map(v => v.id))
      }
      
      await updateLastSyncTime(child.id)
      
    } catch (error) {
      console.error(`Failed to sync for child ${child.id}:`, error)
      
      if (error instanceof TokenExpiredError) {
        await notifyParent(child.parent_id, 'YouTube connection expired')
      }
    }
  }
}
```

**Implementation (Vercel Cron)**:
```typescript
// app/api/cron/sync-watch-history/route.ts
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  await syncWatchHistory()
  
  return Response.json({ success: true })
}
```

**Vercel Config** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-watch-history",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

---

### 2. Analyze Videos Job

**Frequency**: Every 5 minutes
**Timeout**: 120 seconds
**Purpose**: Analyze videos queued for AI analysis

**Queue System**:
Add `analysis_queued` and `analysis_priority` columns to `videos` table:
```sql
ALTER TABLE videos ADD COLUMN analysis_queued BOOLEAN DEFAULT FALSE;
ALTER TABLE videos ADD COLUMN analysis_priority INTEGER DEFAULT 0;
CREATE INDEX idx_videos_queued ON videos(analysis_queued, analysis_priority DESC);
```

**Logic**:
```typescript
export async function analyzeQueuedVideos() {
  const { data: videos } = await supabase
    .from('videos')
    .select(`
      id,
      youtube_video_id,
      title,
      description,
      channel_name,
      duration,
      child_id,
      children!inner(
        age,
        parent_id,
        parents!inner(
          parent_preferences(*)
        )
      )
    `)
    .eq('analysis_queued', true)
    .is('ai_decision', null)
    .order('analysis_priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(10)
  
  if (!videos || videos.length === 0) {
    return { analyzed: 0 }
  }
  
  const results = await Promise.allSettled(
    videos.map(video => analyzeVideo(video.id))
  )
  
  const successCount = results.filter(r => r.status === 'fulfilled').length
  
  await supabase
    .from('videos')
    .update({ analysis_queued: false })
    .in('id', videos.map(v => v.id))
  
  return { 
    analyzed: successCount,
    failed: results.length - successCount,
  }
}
```

**Implementation (Inngest)**:
```typescript
// lib/jobs/inngest.ts
import { Inngest } from 'inngest'

export const inngest = new Inngest({ id: 'youtube-parental-control' })

export const analyzeVideosJob = inngest.createFunction(
  { id: 'analyze-videos', concurrency: 5 },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    const videos = await step.run('fetch-queued-videos', async () => {
      return await fetchQueuedVideos()
    })
    
    const analyses = await step.run('analyze-batch', async () => {
      return await Promise.allSettled(
        videos.map(v => analyzeVideo(v.id))
      )
    })
    
    return { analyzed: analyses.filter(a => a.status === 'fulfilled').length }
  }
)
```

---

### 3. Update Channel Trust Scores Job

**Frequency**: Every 6 hours
**Timeout**: 60 seconds
**Purpose**: Calculate trust scores based on analysis history

**Trust Score Calculation**:
```typescript
export async function updateChannelTrustScores() {
  const { data: channels } = await supabase
    .from('channels')
    .select('id, youtube_channel_id, parent_id')
  
  for (const channel of channels) {
    const { data: videos } = await supabase
      .from('videos')
      .select('ai_decision, ai_confidence')
      .eq('channel_id', channel.youtube_channel_id)
      .not('ai_decision', 'is', null)
    
    if (videos.length === 0) continue
    
    const allowCount = videos.filter(v => v.ai_decision === 'ALLOW').length
    const blockCount = videos.filter(v => v.ai_decision === 'BLOCK').length
    const reviewCount = videos.filter(v => v.ai_decision === 'REVIEW').length
    
    const avgConfidence = videos.reduce((sum, v) => sum + (v.ai_confidence || 0), 0) / videos.length
    
    const trustScore = calculateTrustScore({
      allowCount,
      blockCount,
      reviewCount,
      avgConfidence,
      totalVideos: videos.length,
    })
    
    await supabase
      .from('channels')
      .update({
        trust_score: trustScore,
        videos_analyzed: videos.length,
      })
      .eq('id', channel.id)
  }
}

function calculateTrustScore({
  allowCount,
  blockCount,
  reviewCount,
  avgConfidence,
  totalVideos,
}: {
  allowCount: number
  blockCount: number
  reviewCount: number
  avgConfidence: number
  totalVideos: number
}): number {
  const allowRatio = allowCount / totalVideos
  const blockPenalty = blockCount / totalVideos
  const reviewPenalty = (reviewCount / totalVideos) * 0.5
  
  let score = allowRatio - blockPenalty - reviewPenalty
  
  score *= (avgConfidence / 100)
  
  if (totalVideos < 5) {
    score *= (totalVideos / 5)
  }
  
  return Math.max(0, Math.min(1, score))
}
```

---

### 4. Usage Statistics Aggregation Job

**Frequency**: Daily at 1 AM
**Timeout**: 30 seconds
**Purpose**: Aggregate daily usage stats for billing/analytics

**Logic**:
```typescript
export async function aggregateUsageStats() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toISOString().split('T')[0]
  
  const { data: parents } = await supabase
    .from('parents')
    .select('id')
  
  for (const parent of parents) {
    const { data: videos } = await supabase
      .from('videos')
      .select('id, created_at, analyzed_at, children!inner(parent_id)')
      .eq('children.parent_id', parent.id)
      .gte('analyzed_at', `${dateStr}T00:00:00Z`)
      .lt('analyzed_at', `${dateStr}T23:59:59Z`)
    
    await supabase
      .from('usage_stats')
      .upsert({
        parent_id: parent.id,
        date: dateStr,
        videos_analyzed: videos?.length || 0,
        ai_api_calls: videos?.length || 0,
        ai_tokens_used: estimateTokenUsage(videos?.length || 0),
        youtube_api_calls: Math.ceil((videos?.length || 0) / 50),
      }, {
        onConflict: 'parent_id,date',
      })
  }
}

function estimateTokenUsage(videoCount: number): number {
  return videoCount * 800
}
```

---

### 5. Cleanup Old Data Job

**Frequency**: Weekly (Sunday at 2 AM)
**Timeout**: 60 seconds
**Purpose**: Archive or delete old data

**Logic**:
```typescript
export async function cleanupOldData() {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  
  const { count: deletedVideos } = await supabase
    .from('videos')
    .delete()
    .lt('watched_at', sixMonthsAgo.toISOString())
    .eq('ai_decision', 'ALLOW')
  
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  
  const { count: deletedNotifications } = await supabase
    .from('notifications')
    .delete()
    .lt('created_at', threeMonthsAgo.toISOString())
    .eq('is_read', true)
  
  console.log(`Cleaned up ${deletedVideos} videos and ${deletedNotifications} notifications`)
}
```

---

## Job Scheduling Summary

| Job | Frequency | Timeout | Provider |
|-----|-----------|---------|----------|
| Sync Watch History | Every 30 min | 60s | Vercel Cron |
| Analyze Videos | Every 5 min | 120s | Inngest |
| Update Trust Scores | Every 6 hours | 60s | Vercel Cron |
| Aggregate Stats | Daily 1 AM | 30s | Vercel Cron |
| Cleanup Data | Weekly Sun 2 AM | 60s | Vercel Cron |

---

## Implementation with Inngest (Recommended)

### Setup

```bash
npm install inngest
```

### Create Inngest Client

```typescript
// lib/jobs/inngest.ts
import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'youtube-parental-control',
  eventKey: process.env.INNGEST_EVENT_KEY,
})
```

### Serve Inngest

```typescript
// app/api/inngest/route.ts
import { serve } from 'inngest/next'
import { inngest } from '@/lib/jobs/inngest'
import { 
  syncWatchHistoryJob,
  analyzeVideosJob,
  updateTrustScoresJob,
  aggregateStatsJob,
  cleanupDataJob,
} from '@/lib/jobs/definitions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncWatchHistoryJob,
    analyzeVideosJob,
    updateTrustScoresJob,
    aggregateStatsJob,
    cleanupDataJob,
  ],
})
```

### Define Jobs

```typescript
// lib/jobs/definitions.ts
import { inngest } from './inngest'

export const syncWatchHistoryJob = inngest.createFunction(
  { id: 'sync-watch-history' },
  { cron: '*/30 * * * *' },
  async ({ step }) => {
    return await step.run('sync', async () => {
      return await syncWatchHistory()
    })
  }
)

export const analyzeVideosJob = inngest.createFunction(
  { id: 'analyze-videos', concurrency: 5 },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    return await step.run('analyze', async () => {
      return await analyzeQueuedVideos()
    })
  }
)
```

---

## Error Handling & Monitoring

### Retry Logic

```typescript
export const analyzeVideosJob = inngest.createFunction(
  { 
    id: 'analyze-videos',
    retries: 3,
    onFailure: async ({ error, event }) => {
      await notifyAdmin({
        subject: 'Job Failed: Analyze Videos',
        error: error.message,
      })
    },
  },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    // ...
  }
)
```

### Dead Letter Queue

Store failed jobs in database:
```typescript
CREATE TABLE job_failures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_name VARCHAR(100),
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Testing

### Manual Trigger Endpoints

```typescript
// app/api/admin/trigger-job/route.ts
export async function POST(req: Request) {
  const { jobName } = await req.json()
  
  const jobs = {
    'sync-watch-history': syncWatchHistory,
    'analyze-videos': analyzeQueuedVideos,
    'update-trust-scores': updateChannelTrustScores,
  }
  
  if (jobs[jobName]) {
    const result = await jobs[jobName]()
    return Response.json({ success: true, result })
  }
  
  return Response.json({ error: 'Unknown job' }, { status: 400 })
}
```

---

## Environment Variables

```env
# Inngest
INNGEST_EVENT_KEY=your-event-key
INNGEST_SIGNING_KEY=your-signing-key

# Vercel Cron
CRON_SECRET=random-secret-for-cron-auth

# Job Config
MAX_VIDEOS_PER_SYNC=50
MAX_ANALYSIS_BATCH_SIZE=10
ENABLE_BACKGROUND_JOBS=true
```

---

## Success Metrics

- Job completion rate > 99%
- Average job execution time < 30s
- Zero missed scheduled runs
- Error rate < 1%
- Queue backlog < 100 videos

---

## Future Enhancements

1. **Priority Queue**: Analyze REVIEW-flagged videos first
2. **Smart Scheduling**: Adjust frequency based on watch patterns
3. **Batch Optimization**: Group videos by channel for efficiency
4. **Real-time Updates**: Use webhooks instead of polling
5. **Job Dashboard**: UI to monitor job status and history
6. **Cost Optimization**: Skip analysis for whitelisted channels
