# PRD-04: Dashboard Updates & Video Display

## Overview
Enhance the dashboard to display analyzed videos, show AI decisions, allow parent interactions, and provide insights into child's viewing habits.

## User Flow
1. Parent logs in and lands on dashboard
2. Sees list of children with connection status
3. Clicks on a child to view their videos
4. Sees videos organized by decision (ALLOW/REVIEW/BLOCK)
5. Can filter, sort, and search videos
6. Can click on a video to see detailed analysis
7. Can override AI decisions manually
8. Can whitelist/blacklist channels
9. Sees statistics and insights

---

## Pages to Create/Update

### 1. Dashboard Home (`/app/dashboard/page.tsx`) - UPDATE EXISTING

**Current State**: Shows empty state or children list

**New Features**:

#### Children Cards
```typescript
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {children.map((child) => (
    <Card key={child.id}>
      <CardHeader>
        <CardTitle>{child.name}</CardTitle>
        <CardDescription>{child.age} years old</CardDescription>
      </CardHeader>
      <CardContent>
        {child.youtube_channel_id ? (
          <>
            <Badge variant="success">YouTube Connected</Badge>
            
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Videos Analyzed:</span>
                <span className="font-semibold">{stats.total}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-600">✓ Allowed:</span>
                <span className="font-semibold">{stats.allowed}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-yellow-600">⚠ Review:</span>
                <span className="font-semibold">{stats.review}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-red-600">✕ Blocked:</span>
                <span className="font-semibold">{stats.blocked}</span>
              </div>
            </div>
            
            <Button className="w-full mt-4" asChild>
              <Link href={`/dashboard/${child.id}/videos`}>
                View Videos
              </Link>
            </Button>
          </>
        ) : (
          <Button 
            className="w-full"
            onClick={() => window.location.href = `/api/youtube/auth?childId=${child.id}`}
          >
            Connect YouTube
          </Button>
        )}
      </CardContent>
    </Card>
  ))}
</div>
```

#### Quick Stats Section
```typescript
<div className="grid gap-4 md:grid-cols-4 mb-6">
  <Card>
    <CardContent className="pt-6">
      <div className="text-2xl font-bold">{totalVideos}</div>
      <p className="text-xs text-gray-500">Total Videos</p>
    </CardContent>
  </Card>
  <Card>
    <CardContent className="pt-6">
      <div className="text-2xl font-bold text-yellow-600">{reviewCount}</div>
      <p className="text-xs text-gray-500">Need Review</p>
    </CardContent>
  </Card>
  <Card>
    <CardContent className="pt-6">
      <div className="text-2xl font-bold">{channelCount}</div>
      <p className="text-xs text-gray-500">Channels</p>
    </CardContent>
  </Card>
  <Card>
    <CardContent className="pt-6">
      <div className="text-2xl font-bold">${estimatedCost.toFixed(2)}</div>
      <p className="text-xs text-gray-500">API Cost (MTD)</p>
    </CardContent>
  </Card>
</div>
```

---

### 2. Child Videos Page (`/app/dashboard/[childId]/videos/page.tsx`) - NEW

**Purpose**: Display all videos for a specific child with filtering and sorting

**Layout**:

```
┌─────────────────────────────────────────────────┐
│ Header: Child Name (10 years old)              │
│ [Refresh] [Connect YouTube] [Edit Preferences] │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Filters:                                        │
│ [All] [Allow] [Review] [Block]                 │
│ [Search videos...] [Sort: Recent ▼]            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ ┌─────┬─────────────────────────────────────┐  │
│ │ [📺]│ Video Title                         │  │
│ │     │ Channel Name • 5:30 • 2 hours ago   │  │
│ │     │ ✓ ALLOWED (95% confidence)          │  │
│ │     │ Educational - Science • Value: 8/10 │  │
│ └─────┴─────────────────────────────────────┘  │
│                                                 │
│ ┌─────┬─────────────────────────────────────┐  │
│ │ [📺]│ Another Video                       │  │
│ │     │ Channel • 10:15 • 3 hours ago       │  │
│ │     │ ⚠ REVIEW (72% confidence)           │  │
│ │     │ Gaming • Mild language detected     │  │
│ │     │ [View Details] [Override Decision]  │  │
│ └─────┴─────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Component**:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import VideoCard from '@/components/dashboard/video-card'
import VideoFilters from '@/components/dashboard/video-filters'

export default function ChildVideosPage() {
  const params = useParams()
  const childId = params.childId as string
  
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'ALLOW' | 'REVIEW' | 'BLOCK'>('ALL')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'watched_at' | 'analyzed_at'>('watched_at')
  
  useEffect(() => {
    fetchVideos()
  }, [childId, filter, sort])
  
  async function fetchVideos() {
    setLoading(true)
    
    const params = new URLSearchParams({
      childId,
      ...(filter !== 'ALL' && { decision: filter }),
      sortBy: sort,
      limit: '50',
    })
    
    const response = await fetch(`/api/videos/list?${params}`)
    const data = await response.json()
    
    setVideos(data.videos)
    setLoading(false)
  }
  
  async function refreshVideos() {
    await fetch('/api/videos/fetch', {
      method: 'POST',
      body: JSON.stringify({ childId }),
    })
    
    await fetchVideos()
  }
  
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Videos</h1>
        <Button onClick={refreshVideos}>Refresh Watch History</Button>
      </div>
      
      <VideoFilters
        filter={filter}
        setFilter={setFilter}
        search={search}
        setSearch={setSearch}
        sort={sort}
        setSort={setSort}
      />
      
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-4">
          {videos
            .filter(v => 
              search === '' || 
              v.title.toLowerCase().includes(search.toLowerCase())
            )
            .map((video) => (
              <VideoCard key={video.id} video={video} onUpdate={fetchVideos} />
            ))}
        </div>
      )}
    </div>
  )
}
```

---

### 3. Video Card Component (`/components/dashboard/video-card.tsx`) - NEW

```typescript
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import VideoDetailModal from './video-detail-modal'

interface VideoCardProps {
  video: Video
  onUpdate: () => void
}

export default function VideoCard({ video, onUpdate }: VideoCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  
  const decisionColor = {
    ALLOW: 'bg-green-100 text-green-800',
    REVIEW: 'bg-yellow-100 text-yellow-800',
    BLOCK: 'bg-red-100 text-red-800',
  }[video.ai_decision || 'REVIEW']
  
  const decisionIcon = {
    ALLOW: '✓',
    REVIEW: '⚠',
    BLOCK: '✕',
  }[video.ai_decision || 'REVIEW']
  
  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="w-32 h-20 object-cover rounded"
            />
            
            <div className="flex-1">
              <h3 className="font-semibold line-clamp-2">{video.title}</h3>
              
              <p className="text-sm text-gray-500 mt-1">
                {video.channel_name} • {formatDuration(video.duration)} • {formatTimeAgo(video.watched_at)}
              </p>
              
              <div className="flex items-center gap-2 mt-2">
                <Badge className={decisionColor}>
                  {decisionIcon} {video.ai_decision || 'PENDING'}
                </Badge>
                
                {video.ai_confidence && (
                  <span className="text-xs text-gray-500">
                    {video.ai_confidence}% confidence
                  </span>
                )}
                
                {video.ai_category && (
                  <Badge variant="outline">{video.ai_category}</Badge>
                )}
                
                {video.educational_value && (
                  <span className="text-xs text-gray-500">
                    📚 {video.educational_value}/10
                  </span>
                )}
              </div>
              
              {video.concerns && video.concerns.length > 0 && (
                <div className="mt-2 text-sm text-orange-600">
                  ⚠ {video.concerns.join(', ')}
                </div>
              )}
              
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDetails(true)}
                >
                  View Details
                </Button>
                
                {video.ai_decision === 'REVIEW' && (
                  <>
                    <Button size="sm" variant="outline">
                      Allow
                    </Button>
                    <Button size="sm" variant="outline">
                      Block
                    </Button>
                  </>
                )}
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(`https://youtube.com/watch?v=${video.youtube_video_id}`, '_blank')}
                >
                  Watch on YouTube
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {showDetails && (
        <VideoDetailModal
          video={video}
          onClose={() => setShowDetails(false)}
          onUpdate={onUpdate}
        />
      )}
    </>
  )
}
```

---

### 4. Video Detail Modal (`/components/dashboard/video-detail-modal.tsx`) - NEW

**Purpose**: Show full AI analysis, reasoning, and allow manual overrides

```typescript
'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface VideoDetailModalProps {
  video: Video
  onClose: () => void
  onUpdate: () => void
}

export default function VideoDetailModal({ video, onClose, onUpdate }: VideoDetailModalProps) {
  async function overrideDecision(newDecision: 'ALLOW' | 'BLOCK') {
    await fetch(`/api/videos/${video.id}/override`, {
      method: 'POST',
      body: JSON.stringify({ decision: newDecision }),
    })
    
    onUpdate()
    onClose()
  }
  
  async function whitelistChannel() {
    await fetch(`/api/channels/whitelist`, {
      method: 'POST',
      body: JSON.stringify({ 
        channelId: video.channel_id,
        action: 'add',
      }),
    })
    
    onUpdate()
  }
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{video.title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full rounded"
          />
          
          <div>
            <h3 className="font-semibold mb-2">Video Information</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Channel: {video.channel_name}</div>
              <div>Duration: {formatDuration(video.duration)}</div>
              <div>Watched: {new Date(video.watched_at).toLocaleString()}</div>
              <div>Transcript: {video.has_transcript ? 'Available' : 'Not available'}</div>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">AI Analysis</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span>Decision:</span>
                <Badge>{video.ai_decision}</Badge>
                <span className="text-sm text-gray-500">
                  ({video.ai_confidence}% confidence)
                </span>
              </div>
              
              <div>Category: {video.ai_category}</div>
              <div>Educational Value: {video.educational_value}/10</div>
              
              {video.concerns && video.concerns.length > 0 && (
                <div>
                  <span className="font-semibold">Concerns:</span>
                  <ul className="list-disc list-inside">
                    {video.concerns.map((concern, i) => (
                      <li key={i} className="text-orange-600">{concern}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">AI Reasoning</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {video.ai_reasoning}
            </p>
          </div>
          
          {video.description && (
            <div>
              <h3 className="font-semibold mb-2">Video Description</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {video.description}
              </p>
            </div>
          )}
          
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              className="text-green-600"
              onClick={() => overrideDecision('ALLOW')}
            >
              Override: Allow
            </Button>
            <Button
              variant="outline"
              className="text-red-600"
              onClick={() => overrideDecision('BLOCK')}
            >
              Override: Block
            </Button>
            <Button
              variant="outline"
              onClick={whitelistChannel}
            >
              Whitelist Channel
            </Button>
            <Button
              variant="ghost"
              onClick={() => window.open(`https://youtube.com/watch?v=${video.youtube_video_id}`, '_blank')}
            >
              Watch on YouTube
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

---

### 5. Channels Page (`/app/dashboard/[childId]/channels/page.tsx`) - NEW

**Purpose**: Manage trusted/blocked channels

```typescript
export default function ChannelsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Channels</h1>
      
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Channels</TabsTrigger>
          <TabsTrigger value="whitelisted">Whitelisted</TabsTrigger>
          <TabsTrigger value="blacklisted">Blacklisted</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          <ChannelList type="all" />
        </TabsContent>
        
        <TabsContent value="whitelisted">
          <ChannelList type="whitelisted" />
        </TabsContent>
        
        <TabsContent value="blacklisted">
          <ChannelList type="blacklisted" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

---

### API Endpoints for Dashboard

#### 1. `/api/videos/[videoId]/override/route.ts` (POST)

```typescript
export async function POST(req: Request, { params }: { params: { videoId: string } }) {
  const { decision } = await req.json()
  
  await supabase
    .from('videos')
    .update({ 
      ai_decision: decision,
      parent_override: true,
    })
    .eq('id', params.videoId)
  
  return Response.json({ success: true })
}
```

#### 2. `/api/channels/whitelist/route.ts` (POST)

```typescript
export async function POST(req: Request) {
  const { channelId, action } = await req.json()
  
  await supabase
    .from('channels')
    .update({ 
      is_whitelisted: action === 'add',
      is_blacklisted: false,
    })
    .eq('youtube_channel_id', channelId)
  
  return Response.json({ success: true })
}
```

---

### Utility Functions

```typescript
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatTimeAgo(date: string): string {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}
```

---

### Testing Checklist

- [ ] Dashboard shows children correctly
- [ ] Video stats display accurately
- [ ] Filtering by decision works
- [ ] Search functionality works
- [ ] Sorting works
- [ ] Video cards render correctly
- [ ] Decision badges show correct colors
- [ ] Detail modal displays all information
- [ ] Override decision updates database
- [ ] Whitelist channel works
- [ ] Refresh watch history triggers fetch
- [ ] Responsive design works on mobile
- [ ] Loading states display properly

---

### Success Metrics

- Page load time < 2 seconds
- Videos display correctly 100% of time
- Parent can find specific video in < 10 seconds
- Override actions complete in < 1 second
