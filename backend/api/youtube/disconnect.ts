import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/frontend/lib/supabase/server'
import { revokeGoogleTokens } from '@/backend/services/youtube/oauth'

export async function handleYouTubeDisconnect(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const body = await req.json()
    const { childId } = body
    
    if (!childId) {
      return NextResponse.json(
        { error: 'childId required' },
        { status: 400 }
      )
    }
    
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('id, parent_id, youtube_access_token')
      .eq('id', childId)
      .eq('parent_id', user.id)
      .single()
    
    if (childError || !child) {
      return NextResponse.json(
        { error: 'Child not found or does not belong to you' },
        { status: 404 }
      )
    }
    
    if (child.youtube_access_token) {
      try {
        await revokeGoogleTokens(child.youtube_access_token)
      } catch (error) {
        console.error('Failed to revoke tokens:', error)
      }
    }
    
    const { error: updateError } = await supabase
      .from('children')
      .update({
        youtube_channel_id: null,
        youtube_access_token: null,
        youtube_refresh_token: null,
        token_expires_at: null,
      })
      .eq('id', childId)
    
    if (updateError) {
      console.error('Failed to disconnect YouTube:', updateError)
      return NextResponse.json(
        { error: 'Failed to disconnect YouTube' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('YouTube disconnect error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect YouTube' },
      { status: 500 }
    )
  }
}
