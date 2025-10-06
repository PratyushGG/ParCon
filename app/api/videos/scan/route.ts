import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth/actions'
import { createClient } from '@/lib/supabase/server'
import { fetchWatchHistory, fetchVideoMetadata } from '@/lib/youtube/service'
import { fetchMultipleTranscripts } from '@/lib/youtube/transcript'

/**
 * Trigger initial scan of child's watch history
 * POST /api/videos/scan
 * Body: { childId: string, maxResults?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { childId, maxResults = 50 } = body

    if (!childId) {
      return NextResponse.json(
        { error: 'Child ID required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify child belongs to this parent
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('id, parent_id, name, youtube_access_token')
      .eq('id', childId)
      .eq('parent_id', user.id)
      .single()

    if (childError || !child) {
      return NextResponse.json(
        { error: 'Child not found or unauthorized' },
        { status: 404 }
      )
    }

    if (!child.youtube_access_token) {
      return NextResponse.json(
        { error: 'YouTube not connected for this child' },
        { status: 400 }
      )
    }

    // Step 1: Fetch watch history
    console.log(`Fetching watch history for child ${childId}...`)
    const watchHistory = await fetchWatchHistory(childId, maxResults)

    if (watchHistory.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No videos found in watch history',
        videosProcessed: 0,
      })
    }

    // Step 2: Fetch detailed metadata for all videos
    console.log(`Fetching metadata for ${watchHistory.length} videos...`)
    const videoIds = watchHistory.map((v) => v.videoId)
    const metadata = await fetchVideoMetadata(videoIds, child.youtube_access_token)

    // Create a map for easy lookup
    const metadataMap = new Map(metadata.map((v) => [v.videoId, v]))

    // Step 3: Fetch transcripts for all videos
    console.log(`Fetching transcripts for ${videoIds.length} videos...`)
    const transcripts = await fetchMultipleTranscripts(videoIds)

    // Step 4: Store videos in database
    console.log('Storing videos in database...')
    let savedCount = 0
    let skippedCount = 0

    for (const video of watchHistory) {
      const meta = metadataMap.get(video.videoId)
      const transcript = transcripts.get(video.videoId)

      if (!meta) {
        console.log(`Skipping video ${video.videoId} - no metadata`)
        skippedCount++
        continue
      }

      // Check if video already exists for this child
      const { data: existing } = await supabase
        .from('videos')
        .select('id')
        .eq('child_id', childId)
        .eq('youtube_video_id', video.videoId)
        .single()

      if (existing) {
        console.log(`Skipping video ${video.videoId} - already exists`)
        skippedCount++
        continue
      }

      // Insert new video
      const { error: insertError } = await supabase
        .from('videos')
        .insert({
          child_id: childId,
          youtube_video_id: video.videoId,
          title: meta.title,
          channel_name: meta.channelName,
          channel_id: meta.channelId,
          description: meta.description,
          thumbnail_url: meta.thumbnail,
          duration: meta.duration,
          watched_at: video.watchedAt,
          has_transcript: !!transcript?.transcript,
          transcript_fetch_failed: transcript?.fetchFailed || false,
          // AI analysis fields will be filled later
          ai_decision: null,
          ai_confidence: null,
          ai_category: null,
          educational_value: null,
          concerns: null,
          ai_reasoning: null,
          analyzed_at: null,
        })

      if (insertError) {
        console.error(`Error inserting video ${video.videoId}:`, insertError)
        skippedCount++
      } else {
        savedCount++
      }
    }

    console.log(`Scan complete: ${savedCount} saved, ${skippedCount} skipped`)

    return NextResponse.json({
      success: true,
      message: `Successfully scanned ${watchHistory.length} videos`,
      videosProcessed: watchHistory.length,
      videosSaved: savedCount,
      videosSkipped: skippedCount,
      transcriptsFound: Array.from(transcripts.values()).filter(
        (t) => !!t.transcript
      ).length,
    })
  } catch (error: any) {
    console.error('Video scan error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to scan videos' },
      { status: 500 }
    )
  }
}
