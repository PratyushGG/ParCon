import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/frontend/lib/supabase/server'
import {
  decryptState,
  exchangeCodeForTokens,
  getYouTubeChannelId,
  YouTubeOAuthError,
} from '@/backend/services/youtube/oauth'

export async function handleYouTubeCallback(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.redirect(
        new URL('/login?error=not_authenticated', req.url)
      )
    }
    
    const searchParams = req.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    
    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard?youtube=error&message=${encodeURIComponent(error)}`, req.url)
      )
    }
    
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard?youtube=error&message=missing_parameters', req.url)
      )
    }
    
    let childId: string
    try {
      childId = decryptState(state)
    } catch (error) {
      return NextResponse.redirect(
        new URL('/dashboard?youtube=error&message=invalid_state', req.url)
      )
    }
    
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('id, parent_id')
      .eq('id', childId)
      .eq('parent_id', user.id)
      .single()
    
    if (childError || !child) {
      return NextResponse.redirect(
        new URL('/dashboard?youtube=error&message=child_not_found', req.url)
      )
    }
    
    const tokens = await exchangeCodeForTokens(code)
    
    const youtubeChannelId = await getYouTubeChannelId(tokens.access_token)
    
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
    
    const { error: updateError } = await supabase
      .from('children')
      .update({
        youtube_channel_id: youtubeChannelId,
        youtube_access_token: tokens.access_token,
        youtube_refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt.toISOString(),
      })
      .eq('id', childId)
    
    if (updateError) {
      console.error('Failed to update child record:', updateError)
      return NextResponse.redirect(
        new URL('/dashboard?youtube=error&message=update_failed', req.url)
      )
    }
    
    return NextResponse.redirect(
      new URL(`/dashboard?youtube=connected&childId=${childId}`, req.url)
    )
    
  } catch (error) {
    console.error('YouTube callback error:', error)
    
    if (error instanceof YouTubeOAuthError) {
      return NextResponse.redirect(
        new URL(`/dashboard?youtube=error&message=${encodeURIComponent(error.message)}`, req.url)
      )
    }
    
    return NextResponse.redirect(
      new URL('/dashboard?youtube=error&message=unknown_error', req.url)
    )
  }
}
