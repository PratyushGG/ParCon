import { NextRequest, NextResponse } from 'next/server'
import { getTokensFromCode, getYouTubeClient } from '@/lib/youtube/oauth'
import { getUser } from '@/lib/auth/actions'
import { createClient } from '@/lib/supabase/server'

/**
 * Handle YouTube OAuth callback
 * GET /api/youtube/oauth/callback?code=xxx&state=childId
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser()

    if (!user) {
      // Redirect to login if not authenticated
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state') // This is the child ID
    const error = searchParams.get('error')

    // Handle user denial
    if (error === 'access_denied') {
      return NextResponse.redirect(
        new URL('/dashboard?error=oauth_denied', request.url)
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard?error=oauth_failed', request.url)
      )
    }

    const childId = state

    // Verify child belongs to this parent
    const supabase = await createClient()
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('id, parent_id')
      .eq('id', childId)
      .eq('parent_id', user.id)
      .single()

    if (childError || !child) {
      return NextResponse.redirect(
        new URL('/dashboard?error=invalid_child', request.url)
      )
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(
        new URL('/dashboard?error=token_exchange_failed', request.url)
      )
    }

    // Get YouTube channel ID for this account
    const youtube = getYouTubeClient(tokens.access_token)
    const channelResponse = await youtube.channels.list({
      part: ['id'],
      mine: true,
    })

    const channelId = channelResponse.data.items?.[0]?.id

    if (!channelId) {
      return NextResponse.redirect(
        new URL('/dashboard?error=no_youtube_channel', request.url)
      )
    }

    // Calculate token expiry time
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000) // Default 1 hour

    // Store tokens in database
    const { error: updateError } = await supabase
      .from('children')
      .update({
        youtube_channel_id: channelId,
        youtube_access_token: tokens.access_token,
        youtube_refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt.toISOString(),
      })
      .eq('id', childId)

    if (updateError) {
      console.error('Failed to save tokens:', updateError)
      return NextResponse.redirect(
        new URL('/dashboard?error=save_failed', request.url)
      )
    }

    // Success! Redirect to dashboard
    return NextResponse.redirect(
      new URL('/dashboard?success=youtube_connected', request.url)
    )
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      new URL('/dashboard?error=oauth_error', request.url)
    )
  }
}
