# PRD-02: YouTube Watch History API

## Overview
Fetch a child's YouTube watch history using YouTube Data API v3 and store video metadata in our database for analysis.

## User Flow
1. After successful YouTube OAuth connection
2. System automatically fetches last 50 videos from watch history
3. Video metadata (title, channel, description, thumbnail) stored in database
4. Videos queued for AI analysis
5. Parent can manually trigger "Refresh Watch History" anytime

## Technical Requirements

### YouTube Data API v3

#### Endpoints to Use

**Option 1: Activities API (Preferred)**
```
GET https://www.googleapis.com/youtube/v3/activities
  ?part=snippet,contentDetails
  &mine=true
  &maxResults=50
```

Requires: `youtube.readonly` scope

**Option 2: Search API (Fallback)**
```
GET https://www.googleapis.com/youtube/v3/search
  ?part=snippet
  &forMine=true
  &type=video
  &maxResults=50
```

**Option 3: PlaylistItems API (Watch History)**
```
GET https://www.googleapis.com/youtube/v3/playlistItems
  ?part=snippet,contentDetails
  &playlistId=HL (History List)
  &maxResults=50
```

---

### API Endpoints to Create

#### 1. `/api/videos/fetch/route.ts` (POST)

**Purpose**: Fetch watch history from YouTube and store in database

**Request**:
```json
{
  "childId": "uuid",
  "maxResults": 50,
  "force": false
}
```

**Authentication**: Requires authenticated parent who owns the child

**Logic**:

1. **Validate Request**
   ```typescript
   const user = await getUser()
   const { data: child } = await supabase
     .from('children')
     .select('*')
     .eq('id', childId)
     .eq('parent_id', user.id)
     .single()
   
   if (!child?.youtube_access_token) {
     return { error: 'YouTube not connected' }
   }
   ```

2. **Get Valid Access Token**
   ```typescript
   const accessToken = await getValidAccessToken(childId)
   ```

3. **Fetch Watch History from YouTube**
   ```typescript
   const response = await fetch(
     `https://www.googleapis.com/youtube/v3/activities?` +
     `part=snippet,contentDetails&mine=true&maxResults=${maxResults}`,
     {
       headers: {
         Authorization: `Bearer ${accessToken}`,
       },
     }
   )
   
   const data = await response.json()
   ```

4. **Extract Video IDs**
   ```typescript
   const videoIds = data.items
     .filter(item => item.snippet.type === 'upload' || item.contentDetails.upload)
     .map(item => item.contentDetails.upload?.videoId)
     .filter(Boolean)
   ```

5. **Fetch Video Details** (for videos we don't have yet)
   ```typescript
   const response = await fetch(
     `https://www.googleapis.com/youtube/v3/videos?` +
     `part=snippet,contentDetails,statistics&id=${videoIds.join(',')}`,
     {
       headers: {
         Authorization: `Bearer ${accessToken}`,
       },
     }
   )
   ```

6. **Store in Database**
   ```typescript
   const videosToInsert = data.items.map(video => ({
     child_id: childId,
     youtube_video_id: video.id,
     title: video.snippet.title,
     channel_name: video.snippet.channelTitle,
     channel_id: video.snippet.channelId,
     description: video.snippet.description,
     thumbnail_url: video.snippet.thumbnails.high.url,
     duration: parseDuration(video.contentDetails.duration), // PT4M13S -> 253 seconds
     watched_at: video.snippet.publishedAt, // or from activity timestamp
     has_transcript: false, // will check later
     transcript_fetch_failed: false,
     created_at: new Date().toISOString(),
   }))
   
   const { data: insertedVideos, error } = await supabase
     .from('videos')
     .upsert(videosToInsert, {
       onConflict: 'child_id,youtube_video_id',
       ignoreDuplicates: true,
     })
     .select()
   ```

7. **Update Channel Records**
   ```typescript
   const channels = extractUniqueChannels(data.items)
   
   await supabase
     .from('channels')
     .upsert(channels, {
       onConflict: 'youtube_channel_id,parent_id',
       ignoreDuplicates: true,
     })
   ```

8. **Queue Videos for Analysis**
   ```typescript
   await queueVideosForAnalysis(insertedVideos.map(v => v.id))
   ```

9. **Update Usage Stats**
   ```typescript
   await supabase
     .from('usage_stats')
     .upsert({
       parent_id: user.id,
       date: new Date().toISOString().split('T')[0],
       youtube_api_calls: increment(1),
     })
   ```

**Response**:
```json
{
  "success": true,
  "videosCount": 45,
  "newVideosCount": 12,
  "duplicatesSkipped": 33,
  "queuedForAnalysis": 12
}
```

**Error Responses**:
- 401: Not authenticated
- 403: Child doesn't belong to parent
- 404: Child not found or YouTube not connected
- 429: YouTube API rate limit exceeded
- 500: Server error

---

#### 2. `/api/videos/list/route.ts` (GET)

**Purpose**: Retrieve videos for a child with optional filtering

**Request**:
```
GET /api/videos/list?childId=uuid&limit=50&offset=0&decision=REVIEW&sortBy=watched_at
```

**Query Parameters**:
- `childId` (required): Child UUID
- `limit` (optional): Default 50, max 100
- `offset` (optional): For pagination
- `decision` (optional): Filter by ALLOW/REVIEW/BLOCK
- `sortBy` (optional): watched_at | analyzed_at | created_at
- `order` (optional): asc | desc (default: desc)

**Logic**:
```typescript
const user = await getUser()

let query = supabase
  .from('videos')
  .select('*, children!inner(parent_id)')
  .eq('children.parent_id', user.id)
  .eq('child_id', childId)
  .order(sortBy, { ascending: order === 'asc' })
  .range(offset, offset + limit - 1)

if (decision) {
  query = query.eq('ai_decision', decision)
}

const { data: videos, error } = await query
```

**Response**:
```json
{
  "videos": [
    {
      "id": "uuid",
      "youtube_video_id": "dQw4w9WgXcQ",
      "title": "Video Title",
      "channel_name": "Channel Name",
      "thumbnail_url": "https://...",
      "duration": 253,
      "watched_at": "2025-01-15T10:30:00Z",
      "ai_decision": "ALLOW",
      "ai_confidence": 95,
      "ai_category": "Educational",
      "educational_value": 8,
      "concerns": [],
      "ai_reasoning": "...",
      "analyzed_at": "2025-01-15T10:35:00Z"
    }
  ],
  "total": 45,
  "limit": 50,
  "offset": 0
}
```

---

#### 3. `/api/videos/[videoId]/route.ts` (GET)

**Purpose**: Get detailed information about a specific video

**Request**:
```
GET /api/videos/abc-123-uuid
```

**Response**:
```json
{
  "id": "uuid",
  "youtube_video_id": "dQw4w9WgXcQ",
  "title": "Video Title",
  "channel_name": "Channel Name",
  "channel_id": "UC...",
  "description": "Full description...",
  "thumbnail_url": "https://...",
  "duration": 253,
  "watched_at": "2025-01-15T10:30:00Z",
  "has_transcript": true,
  "ai_decision": "ALLOW",
  "ai_confidence": 95,
  "ai_category": "Educational",
  "educational_value": 8,
  "concerns": [],
  "ai_reasoning": "Detailed analysis...",
  "analyzed_at": "2025-01-15T10:35:00Z",
  "child": {
    "id": "uuid",
    "name": "Child Name",
    "age": 10
  }
}
```

---

### Service Layer

#### `/lib/services/youtube/api.ts`

```typescript
export interface YouTubeVideo {
  id: string
  snippet: {
    title: string
    channelId: string
    channelTitle: string
    description: string
    publishedAt: string
    thumbnails: {
      high: { url: string }
    }
  }
  contentDetails: {
    duration: string // ISO 8601 duration (PT4M13S)
  }
}

export async function fetchWatchHistory(
  accessToken: string,
  maxResults: number = 50
): Promise<YouTubeVideo[]> {
  const activitiesRes = await fetch(
    `https://www.googleapis.com/youtube/v3/activities?` +
    `part=snippet,contentDetails&mine=true&maxResults=${maxResults}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  
  if (!activitiesRes.ok) {
    throw new YouTubeAPIError(activitiesRes.status, await activitiesRes.text())
  }
  
  const activities = await activitiesRes.json()
  
  const videoIds = activities.items
    .filter(item => item.contentDetails?.upload?.videoId)
    .map(item => item.contentDetails.upload.videoId)
  
  if (videoIds.length === 0) return []
  
  const videosRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?` +
    `part=snippet,contentDetails&id=${videoIds.join(',')}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  
  const videos = await videosRes.json()
  return videos.items
}

export function parseDuration(isoDuration: string): number {
  // PT4M13S -> 253 seconds
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  
  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  const seconds = parseInt(match[3] || '0')
  
  return hours * 3600 + minutes * 60 + seconds
}

export class YouTubeAPIError extends Error {
  constructor(public status: number, public body: string) {
    super(`YouTube API Error: ${status}`)
  }
}
```

---

### Database Operations

#### Upsert Logic (Avoid Duplicates)

```typescript
const { data, error } = await supabase
  .from('videos')
  .upsert(videosToInsert, {
    onConflict: 'child_id,youtube_video_id',
    ignoreDuplicates: true, // Skip if already exists
  })
  .select()
```

#### Channel Aggregation

```typescript
async function updateChannelStats(channelId: string, parentId: string) {
  const { count } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('channel_id', channelId)
  
  await supabase
    .from('channels')
    .update({ videos_analyzed: count })
    .eq('youtube_channel_id', channelId)
    .eq('parent_id', parentId)
}
```

---

### Rate Limiting

YouTube Data API v3 quotas:
- **10,000 units per day** (default free tier)
- Activities API: 1 unit per request
- Videos API: 1 unit per request
- Total for 50 videos: ~2 units

**Strategy**:
1. Cache video metadata for 24 hours
2. Only fetch new videos (check last `watched_at`)
3. Implement exponential backoff on 429 errors
4. Track usage in `usage_stats` table

---

### Error Handling

1. **Token Expired**: Auto-refresh and retry
2. **Rate Limit (429)**: Return friendly error, show retry countdown
3. **Invalid Grant**: Prompt re-authentication
4. **Network Error**: Retry with exponential backoff
5. **API Down**: Log and notify, show cached data

---

### Testing Checklist

- [ ] Fetch history for newly connected account
- [ ] Handle duplicate videos correctly (upsert)
- [ ] Parse ISO 8601 duration correctly
- [ ] Store all required video metadata
- [ ] Update channel records
- [ ] Handle pagination for >50 videos
- [ ] Token refresh works during fetch
- [ ] Rate limit handling
- [ ] Error states display properly
- [ ] Videos list API returns correct data
- [ ] Filtering by decision works
- [ ] Pagination works

---

### Performance Considerations

1. **Batch Operations**: Insert videos in batches of 50
2. **Parallel Requests**: Fetch activities and video details in parallel when possible
3. **Caching**: Cache channel metadata to avoid repeated lookups
4. **Indexing**: Ensure DB indexes on `child_id`, `watched_at`, `ai_decision`

---

### Success Metrics

- Video fetch success rate > 95%
- Average fetch time < 5 seconds
- Duplicate detection works 100%
- API quota usage < 50% of daily limit

---

### Future Enhancements

1. Incremental sync (only new videos since last fetch)
2. Real-time watch history updates via webhooks
3. Support for pagination (fetch >50 videos)
4. Video thumbnail caching/CDN
5. Watch time tracking (how much of video was watched)
