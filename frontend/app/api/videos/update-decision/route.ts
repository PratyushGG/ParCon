import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/frontend/lib/auth/actions'
import { createClient } from '@/frontend/lib/supabase/server'

/**
 * Update a video's AI decision (parent override)
 * POST /api/videos/update-decision
 * Body: { videoId: string, decision: 'ALLOW' | 'REVIEW' | 'BLOCK' }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { videoId, decision } = body

    if (!videoId || !decision) {
      return NextResponse.json(
        { error: 'Video ID and decision required' },
        { status: 400 }
      )
    }

    if (!['ALLOW', 'REVIEW', 'BLOCK'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify the video belongs to one of this parent's children
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id, child_id, children!inner(parent_id)')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      )
    }

    // Type assertion to access nested relation
    const videoWithChild = video as any
    if (videoWithChild.children?.parent_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Update the video decision
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        ai_decision: decision,
      })
      .eq('id', videoId)

    if (updateError) {
      console.error('Error updating video:', updateError)
      return NextResponse.json(
        { error: 'Failed to update video' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Update decision error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update video decision' },
      { status: 500 }
    )
  }
}
