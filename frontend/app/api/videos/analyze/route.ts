import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth/actions'
import { createClient } from '@/lib/supabase/server'
import { analyzeVideo } from '@/lib/ai/analyzer'
import { fetchVideoTranscript } from '@/lib/youtube/transcript'

/**
 * Analyze videos using AI
 * POST /api/videos/analyze
 * Body: { childId: string, limit?: number }
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
    const { childId, limit = 10 } = body

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
      .select('id, parent_id, name, age')
      .eq('id', childId)
      .eq('parent_id', user.id)
      .single()

    if (childError || !child) {
      return NextResponse.json(
        { error: 'Child not found or unauthorized' },
        { status: 404 }
      )
    }

    // Get parent preferences
    const { data: preferences } = await supabase
      .from('parent_preferences')
      .select('*')
      .eq('parent_id', user.id)
      .single()

    if (!preferences) {
      return NextResponse.json(
        { error: 'Parent preferences not found. Please complete onboarding.' },
        { status: 400 }
      )
    }

    // Get unanalyzed videos for this child
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('*')
      .eq('child_id', childId)
      .is('ai_decision', null) // Only get videos that haven't been analyzed
      .limit(limit)

    if (videosError) {
      console.error('Error fetching videos:', videosError)
      return NextResponse.json(
        { error: 'Failed to fetch videos' },
        { status: 500 }
      )
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No videos to analyze',
        videosAnalyzed: 0,
      })
    }

    console.log(`Analyzing ${videos.length} videos for child ${child.name} (age ${child.age})...`)

    let analyzedCount = 0
    let failedCount = 0

    for (const video of videos) {
      try {
        // Fetch transcript if we haven't tried yet and it's not marked as failed
        let transcript = null
        if (!video.has_transcript && !video.transcript_fetch_failed) {
          const transcriptResult = await fetchVideoTranscript(video.youtube_video_id)
          transcript = transcriptResult.transcript

          // Update transcript status in database
          await supabase
            .from('videos')
            .update({
              has_transcript: !!transcript,
              transcript_fetch_failed: transcriptResult.fetchFailed,
            })
            .eq('id', video.id)
        }

        // Analyze the video
        console.log(`Analyzing: ${video.title}`)
        const analysis = await analyzeVideo(
          {
            title: video.title || '',
            description: video.description || '',
            channelName: video.channel_name || '',
            duration: video.duration || 0,
            transcript,
          },
          child.age,
          {
            allowedTopics: preferences.allowed_topics || [],
            blockedTopics: preferences.blocked_topics || [],
            allowMildLanguage: preferences.allow_mild_language || false,
            educationalPriority: preferences.educational_priority || 'high',
          }
        )

        // Save analysis results
        const { error: updateError } = await supabase
          .from('videos')
          .update({
            ai_decision: analysis.decision,
            ai_confidence: analysis.confidence,
            ai_category: analysis.category,
            educational_value: analysis.educationalValue,
            concerns: analysis.concerns,
            ai_reasoning: analysis.reasoning,
            analyzed_at: new Date().toISOString(),
          })
          .eq('id', video.id)

        if (updateError) {
          console.error(`Failed to save analysis for video ${video.id}:`, updateError)
          failedCount++
        } else {
          console.log(`✓ ${analysis.decision} (confidence: ${analysis.confidence}%) - ${video.title}`)
          analyzedCount++
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200))
      } catch (error: any) {
        console.error(`Error analyzing video ${video.id}:`, error)
        failedCount++
      }
    }

    console.log(`Analysis complete: ${analyzedCount} analyzed, ${failedCount} failed`)

    return NextResponse.json({
      success: true,
      message: `Successfully analyzed ${analyzedCount} videos`,
      videosAnalyzed: analyzedCount,
      videosFailed: failedCount,
      totalVideos: videos.length,
    })
  } catch (error: any) {
    console.error('Video analysis error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze videos' },
      { status: 500 }
    )
  }
}
