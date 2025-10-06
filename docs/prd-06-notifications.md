# PRD-06: Notification System

## Overview
Alert parents when videos require review, when YouTube connections expire, or when important events occur. Provide in-app notifications and optional email notifications.

## User Flow
1. AI analyzes video and marks as REVIEW
2. System creates notification for parent
3. Parent sees notification badge in dashboard header
4. Parent clicks notification bell to view list
5. Parent clicks notification to see video details
6. Parent marks notification as read
7. (Optional) Parent receives email digest of unread notifications

---

## Notification Types

### 1. Video Needs Review
**Trigger**: AI marks video as REVIEW
**Priority**: High
**Title**: "Video Needs Review"
**Message**: `"[Video Title]" from [Channel Name] requires your attention`
**Action**: Link to video detail page

### 2. YouTube Connection Expired
**Trigger**: Token refresh fails
**Priority**: Critical
**Title**: "YouTube Connection Expired"
**Message**: `"[Child Name]'s YouTube connection needs to be renewed"`
**Action**: Link to reconnect OAuth flow

### 3. Blocked Content Detected
**Trigger**: AI marks video as BLOCK
**Priority**: Medium
**Title**: "Blocked Content Detected"
**Message**: `"[Video Title]" was blocked based on your preferences`
**Action**: Link to video detail page (for review/override)

### 4. Multiple Videos Needing Review
**Trigger**: 5+ videos marked as REVIEW in 1 hour
**Priority**: High
**Title**: "Multiple Videos Need Review"
**Message**: `"[X] videos from the last hour require your attention"`
**Action**: Link to filtered video list (REVIEW only)

### 5. Channel Whitelisted Auto-Allow
**Trigger**: Video from whitelisted channel auto-allowed
**Priority**: Low (Info)
**Title**: "Videos Auto-Allowed"
**Message**: `"[X] videos from trusted channels were automatically allowed"`
**Action**: Link to allowed videos list

### 6. Weekly Summary
**Trigger**: Every Sunday at 6 PM
**Priority**: Low (Info)
**Title**: "Weekly Summary"
**Message**: `"This week: [X] videos watched, [Y] required review, [Z] blocked"`
**Action**: Link to analytics dashboard

---

## Technical Requirements

### Database Schema (Already Exists)

```sql
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
```

**Additional Columns to Add**:
```sql
ALTER TABLE notifications ADD COLUMN action_url TEXT;
ALTER TABLE notifications ADD COLUMN priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE notifications ADD COLUMN metadata JSONB;
```

---

## API Endpoints

### 1. `/api/notifications/list/route.ts` (GET)

**Purpose**: Get notifications for authenticated parent

**Request**:
```
GET /api/notifications/list?limit=20&unreadOnly=true
```

**Query Parameters**:
- `limit` (optional): Default 20, max 100
- `unreadOnly` (optional): If true, return only unread
- `offset` (optional): For pagination

**Logic**:
```typescript
export async function GET(req: Request) {
  const user = await getUser()
  
  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get('limit') || '20')
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true'
  const offset = parseInt(url.searchParams.get('offset') || '0')
  
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('parent_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  if (unreadOnly) {
    query = query.eq('is_read', false)
  }
  
  const { data: notifications, error } = await query
  
  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('parent_id', user.id)
    .eq('is_read', false)
  
  return Response.json({
    notifications,
    unreadCount,
  })
}
```

**Response**:
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "video_review",
      "title": "Video Needs Review",
      "message": "\"Minecraft Tutorial\" requires your attention",
      "is_read": false,
      "priority": "high",
      "action_url": "/dashboard/abc-123/videos/xyz-789",
      "metadata": {
        "videoId": "xyz-789",
        "childId": "abc-123"
      },
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "unreadCount": 5
}
```

---

### 2. `/api/notifications/[notificationId]/read/route.ts` (POST)

**Purpose**: Mark notification as read

**Request**:
```
POST /api/notifications/abc-123/read
```

**Logic**:
```typescript
export async function POST(
  req: Request,
  { params }: { params: { notificationId: string } }
) {
  const user = await getUser()
  
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', params.notificationId)
    .eq('parent_id', user.id)
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  
  return Response.json({ success: true })
}
```

---

### 3. `/api/notifications/mark-all-read/route.ts` (POST)

**Purpose**: Mark all notifications as read

**Logic**:
```typescript
export async function POST(req: Request) {
  const user = await getUser()
  
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('parent_id', user.id)
    .eq('is_read', false)
  
  return Response.json({ success: true })
}
```

---

### 4. `/api/notifications/delete/route.ts` (DELETE)

**Purpose**: Delete notification

**Logic**:
```typescript
export async function DELETE(req: Request) {
  const user = await getUser()
  const { notificationId } = await req.json()
  
  await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('parent_id', user.id)
  
  return Response.json({ success: true })
}
```

---

## Service Layer

### `/lib/services/notifications/create.ts`

```typescript
export interface CreateNotificationParams {
  parent_id: string
  type: NotificationType
  title: string
  message: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  action_url?: string
  metadata?: Record<string, any>
}

export type NotificationType = 
  | 'video_review'
  | 'video_blocked'
  | 'youtube_expired'
  | 'multiple_reviews'
  | 'weekly_summary'
  | 'channel_whitelisted'

export async function createNotification(params: CreateNotificationParams) {
  const { error } = await supabase
    .from('notifications')
    .insert({
      parent_id: params.parent_id,
      type: params.type,
      title: params.title,
      message: params.message,
      priority: params.priority || 'medium',
      action_url: params.action_url,
      metadata: params.metadata,
    })
  
  if (error) {
    console.error('Failed to create notification:', error)
    throw error
  }
  
  if (params.priority === 'critical') {
    await sendEmailNotification(params)
  }
}

export async function createVideoReviewNotification(
  parentId: string,
  videoId: string,
  videoTitle: string,
  childId: string
) {
  await createNotification({
    parent_id: parentId,
    type: 'video_review',
    title: 'Video Needs Review',
    message: `"${videoTitle}" requires your attention`,
    priority: 'high',
    action_url: `/dashboard/${childId}/videos/${videoId}`,
    metadata: { videoId, childId },
  })
}

export async function createYouTubeExpiredNotification(
  parentId: string,
  childId: string,
  childName: string
) {
  await createNotification({
    parent_id: parentId,
    type: 'youtube_expired',
    title: 'YouTube Connection Expired',
    message: `${childName}'s YouTube connection needs to be renewed`,
    priority: 'critical',
    action_url: `/api/youtube/auth?childId=${childId}`,
    metadata: { childId },
  })
}

export async function createWeeklySummaryNotification(
  parentId: string,
  stats: {
    videosWatched: number
    reviewNeeded: number
    blocked: number
  }
) {
  await createNotification({
    parent_id: parentId,
    type: 'weekly_summary',
    title: 'Weekly Summary',
    message: `This week: ${stats.videosWatched} videos watched, ${stats.reviewNeeded} required review, ${stats.blocked} blocked`,
    priority: 'low',
    action_url: '/dashboard',
    metadata: stats,
  })
}
```

---

## Frontend Components

### 1. Notification Bell (`/components/dashboard/notification-bell.tsx`)

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'

export default function NotificationBell() {
  const router = useRouter()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  
  useEffect(() => {
    fetchNotifications()
    
    const interval = setInterval(fetchNotifications, 30000)
    
    return () => clearInterval(interval)
  }, [])
  
  async function fetchNotifications() {
    const response = await fetch('/api/notifications/list?limit=5&unreadOnly=false')
    const data = await response.json()
    
    setNotifications(data.notifications)
    setUnreadCount(data.unreadCount)
  }
  
  async function markAsRead(notificationId: string) {
    await fetch(`/api/notifications/${notificationId}/read`, {
      method: 'POST',
    })
    
    await fetchNotifications()
  }
  
  async function markAllAsRead() {
    await fetch('/api/notifications/mark-all-read', {
      method: 'POST',
    })
    
    await fetchNotifications()
  }
  
  function handleNotificationClick(notification: any) {
    markAsRead(notification.id)
    
    if (notification.action_url) {
      router.push(notification.action_url)
    }
    
    setOpen(false)
  }
  
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
            >
              Mark all read
            </Button>
          )}
        </div>
        
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No notifications
          </div>
        ) : (
          <>
            {notifications.map((notification: any) => (
              <DropdownMenuItem
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`px-4 py-3 cursor-pointer ${
                  !notification.is_read ? 'bg-blue-50' : ''
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm">
                      {notification.title}
                    </p>
                    {!notification.is_read && (
                      <span className="h-2 w-2 rounded-full bg-blue-600 mt-1" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatTimeAgo(notification.created_at)}
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
            
            <div className="border-t">
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  router.push('/dashboard/notifications')
                  setOpen(false)
                }}
              >
                View All
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### 2. Update Dashboard Header (`/components/dashboard/header.tsx`)

```typescript
import NotificationBell from './notification-bell'

export default function DashboardHeader() {
  return (
    <header className="border-b">
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-2xl font-bold">YouTube Parental Control</h1>
        
        <div className="flex items-center gap-4">
          <NotificationBell />
          
          <Button variant="ghost" onClick={() => signOut()}>
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  )
}
```

---

### 3. All Notifications Page (`/app/dashboard/notifications/page.tsx`)

```typescript
export default function NotificationsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <Button onClick={markAllAsRead}>Mark All as Read</Button>
      </div>
      
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="high">High Priority</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          <NotificationList filter="all" />
        </TabsContent>
        
        <TabsContent value="unread">
          <NotificationList filter="unread" />
        </TabsContent>
        
        <TabsContent value="high">
          <NotificationList filter="high" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

---

## Email Notifications (Optional)

### Email Service (`/lib/services/email/send.ts`)

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmailNotification(params: CreateNotificationParams) {
  const parent = await getParentById(params.parent_id)
  
  if (!parent?.email) return
  
  await resend.emails.send({
    from: 'notifications@yourapp.com',
    to: parent.email,
    subject: params.title,
    html: `
      <h2>${params.title}</h2>
      <p>${params.message}</p>
      ${params.action_url ? `
        <a href="${process.env.NEXT_PUBLIC_APP_URL}${params.action_url}">
          View Details
        </a>
      ` : ''}
    `,
  })
}
```

### Weekly Digest Job

```typescript
export async function sendWeeklyDigest() {
  const { data: parents } = await supabase
    .from('parents')
    .select('id, email')
  
  for (const parent of parents) {
    const stats = await getWeeklyStats(parent.id)
    
    const unreadNotifications = await getUnreadNotifications(parent.id, 7)
    
    if (unreadNotifications.length === 0) continue
    
    await resend.emails.send({
      from: 'digest@yourapp.com',
      to: parent.email,
      subject: 'Your Weekly YouTube Summary',
      html: renderWeeklyDigestEmail(stats, unreadNotifications),
    })
  }
}
```

---

## Push Notifications (Future Enhancement)

Use service workers for browser push notifications:

```typescript
export async function sendPushNotification(
  parentId: string,
  notification: CreateNotificationParams
) {
  const subscription = await getPushSubscription(parentId)
  
  if (!subscription) return
  
  await webpush.sendNotification(subscription, JSON.stringify({
    title: notification.title,
    body: notification.message,
    icon: '/icon.png',
    badge: '/badge.png',
    data: {
      url: notification.action_url,
    },
  }))
}
```

---

## Testing Checklist

- [ ] Notifications created when video marked REVIEW
- [ ] Notification badge shows correct unread count
- [ ] Clicking notification navigates to correct page
- [ ] Mark as read updates UI immediately
- [ ] Mark all as read works
- [ ] Notification dropdown displays correctly
- [ ] Email sent for critical notifications
- [ ] Weekly summary generated correctly
- [ ] Real-time updates (polling every 30s)
- [ ] Delete notification works

---

## Success Metrics

- Notification delivery rate 100%
- Parent engagement rate with notifications > 70%
- Average time to address REVIEW notification < 4 hours
- Email open rate > 40%
- Zero notification delivery failures

---

## Future Enhancements

1. **Real-time via WebSockets**: Instant notifications without polling
2. **Push Notifications**: Browser push for desktop/mobile
3. **SMS Alerts**: For critical notifications
4. **Notification Preferences**: Let parents choose which notifications to receive
5. **Snooze Feature**: Temporarily hide notifications
6. **Smart Grouping**: Combine similar notifications
7. **Notification Analytics**: Track which notifications are most effective
