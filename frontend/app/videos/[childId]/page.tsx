import { createClient } from '@/frontend/lib/supabase/server'
import { getUser } from '@/frontend/lib/auth/actions'
import { redirect } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/frontend/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Badge } from '@/frontend/components/ui/badge'
import type { Video, Child } from '@/shared/types/database'
import { VideoCard } from '@/frontend/components/videos/video-card'
import { SummaryStats } from '@/frontend/components/videos/summary-stats'

export default async function VideosPage({ params }: { params: Promise<{ childId: string }> }) {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const { childId } = await params

  // Verify child belongs to this parent
  const { data: child, error: childError } = await supabase
    .from('children')
    .select('*')
    .eq('id', childId)
    .eq('parent_id', user.id)
    .single()

  if (childError || !child) {
    redirect('/dashboard')
  }

  // Fetch all videos for this child
  const { data: videos, error: videosError } = await supabase
    .from('videos')
    .select('*')
    .eq('child_id', childId)
    .order('watched_at', { ascending: false })

  if (videosError) {
    console.error('Error fetching videos:', videosError)
  }

  // Categorize videos by AI decision
  const approvedVideos = videos?.filter((v) => v.ai_decision === 'ALLOW') || []
  const reviewVideos = videos?.filter((v) => v.ai_decision === 'REVIEW') || []
  const flaggedVideos = videos?.filter((v) => v.ai_decision === 'BLOCK') || []

  // Calculate stats
  const totalVideos = videos?.length || 0
  const totalDuration = videos?.reduce((sum, v) => sum + (v.duration || 0), 0) || 0
  const totalHours = (totalDuration / 3600).toFixed(1)
  const educationalCount = videos?.filter((v) => (v.educational_value || 0) >= 7).length || 0
  const educationalPercent = totalVideos > 0 ? Math.round((educationalCount / totalVideos) * 100) : 0

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Video Analysis</h1>
        <p className="text-gray-600 mt-1">
          {child.name}'s YouTube activity
        </p>
      </div>

      {/* Summary Stats */}
      <SummaryStats
        totalVideos={totalVideos}
        totalHours={parseFloat(totalHours)}
        educationalPercent={educationalPercent}
        reviewCount={reviewVideos.length}
      />

      {/* Tabs */}
      <Tabs defaultValue="review" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="approved" className="relative">
            Approved
            {approvedVideos.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {approvedVideos.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="review" className="relative">
            Needs Review
            {reviewVideos.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-yellow-500 text-white">
                {reviewVideos.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="flagged" className="relative">
            Flagged
            {flaggedVideos.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {flaggedVideos.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approved" className="mt-6">
          {approvedVideos.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                No approved videos yet
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {approvedVideos.map((video) => (
                <VideoCard key={video.id} video={video} childId={childId} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="review" className="mt-6">
          {reviewVideos.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                No videos need review
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reviewVideos.map((video) => (
                <VideoCard key={video.id} video={video} childId={childId} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="flagged" className="mt-6">
          {flaggedVideos.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                No flagged videos
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {flaggedVideos.map((video) => (
                <VideoCard key={video.id} video={video} childId={childId} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
