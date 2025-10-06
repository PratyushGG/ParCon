import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/youtube/oauth'
import { getUser } from '@/lib/auth/actions'
import { createClient } from '@/lib/supabase/server'

/**
 * Start YouTube OAuth flow
 * GET /api/youtube/oauth/start?childId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const childId = searchParams.get('childId')

    if (!childId) {
      return NextResponse.json(
        { error: 'Child ID required' },
        { status: 400 }
      )
    }

    // Verify child belongs to this parent
    const supabase = await createClient()
    const { data: child, error } = await supabase
      .from('children')
      .select('id, parent_id')
      .eq('id', childId)
      .eq('parent_id', user.id)
      .single()

    if (error || !child) {
      return NextResponse.json(
        { error: 'Child not found or unauthorized' },
        { status: 404 }
      )
    }

    // Generate OAuth URL with child ID as state
    const authUrl = getAuthUrl(childId)

    // Redirect to Google OAuth
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('OAuth start error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate OAuth' },
      { status: 500 }
    )
  }
}
