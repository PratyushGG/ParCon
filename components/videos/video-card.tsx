'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, ThumbsUp, ThumbsDown, Ban } from 'lucide-react'
import type { Video } from '@/lib/types/database'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface VideoCardProps {
  video: Video
  childId: string
}

export function VideoCard({ video, childId }: VideoCardProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // Format duration (seconds to MM:SS)
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Format times
  const watchedTime = video.watched_at
    ? formatDistanceToNow(new Date(video.watched_at), { addSuffix: true })
    : 'Unknown'

  // Get decision badge color
  const getDecisionBadge = () => {
    switch (video.ai_decision) {
      case 'ALLOW':
        return <Badge className="bg-green-500">Approved</Badge>
      case 'REVIEW':
        return <Badge className="bg-yellow-500">Needs Review</Badge>
      case 'BLOCK':
        return <Badge variant="destructive">Flagged</Badge>
      default:
        return <Badge variant="outline">Not Analyzed</Badge>
    }
  }

  // Get category badge
  const getCategoryBadge = () => {
    if (!video.ai_category) return null
    return <Badge variant="outline">{video.ai_category}</Badge>
  }

  // Get educational value badge
  const getEducationalBadge = () => {
    if (video.educational_value === null) return null
    const value = video.educational_value
    if (value >= 7) {
      return <Badge className="bg-blue-500">High Educational Value</Badge>
    } else if (value >= 4) {
      return <Badge variant="outline">Moderate Educational Value</Badge>
    }
    return null
  }

  // Handle approve
  const handleApprove = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/videos/update-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          decision: 'ALLOW',
        }),
      })

      if (response.ok) {
        router.refresh()
      } else {
        alert('Failed to update video')
      }
    } catch (error) {
      console.error('Error updating video:', error)
      alert('Failed to update video')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle block
  const handleBlock = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/videos/update-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          decision: 'BLOCK',
        }),
      })

      if (response.ok) {
        router.refresh()
      } else {
        alert('Failed to update video')
      }
    } catch (error) {
      console.error('Error updating video:', error)
      alert('Failed to update video')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          {/* Video Info */}
          <div className="flex-1 space-y-2">
            <div className="flex items-start gap-3">
              {/* Thumbnail placeholder */}
              <div className="w-32 h-20 bg-gray-200 rounded-md flex-shrink-0 flex items-center justify-center">
                <span className="text-xs text-gray-500">YouTube</span>
              </div>

              <div className="flex-1 min-w-0">
                <a
                  href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  <CardTitle className="text-lg line-clamp-2 text-blue-600 hover:text-blue-800">
                    {video.title}
                  </CardTitle>
                </a>
                <CardDescription className="mt-1">
                  {video.channel_name} • {formatDuration(video.duration || 0)} • Watched {watchedTime}
                </CardDescription>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {getDecisionBadge()}
              {getCategoryBadge()}
              {getEducationalBadge()}
              {video.ai_confidence !== null && (
                <Badge variant="outline">{video.ai_confidence}% confidence</Badge>
              )}
            </div>

            {/* AI Reasoning */}
            {video.ai_reasoning && (
              <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-700">
                <p className="font-medium mb-1">AI Analysis:</p>
                <p>{video.ai_reasoning}</p>
              </div>
            )}

            {/* Concerns */}
            {video.concerns && video.concerns.length > 0 && (
              <div className="bg-red-50 p-3 rounded-md text-sm text-red-800">
                <p className="font-medium mb-1">Concerns:</p>
                <ul className="list-disc list-inside space-y-1">
                  {video.concerns.map((concern, i) => (
                    <li key={i}>{concern}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-wrap gap-2">
          {/* Approve button (show if not already approved) */}
          {video.ai_decision !== 'ALLOW' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleApprove}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <ThumbsUp className="h-4 w-4" />
              Approve
            </Button>
          )}

          {/* Block button (show if not already blocked) */}
          {video.ai_decision !== 'BLOCK' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBlock}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <ThumbsDown className="h-4 w-4" />
              Block
            </Button>
          )}

          {/* View on YouTube */}
          <Button
            variant="outline"
            size="sm"
            asChild
            className="flex items-center gap-2"
          >
            <a
              href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
              View on YouTube
            </a>
          </Button>

          {/* Block Channel */}
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            disabled={isLoading}
          >
            <Ban className="h-4 w-4" />
            Block Channel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
