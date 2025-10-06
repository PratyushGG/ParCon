import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/frontend/lib/supabase/server'
import { buildOAuthUrl, encryptState } from '@/backend/services/youtube/oauth'

export async function handleYouTubeAuth(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const searchParams = req.nextUrl.searchParams
    const childId = searchParams.get('childId')
    
    if (!childId) {
      return NextResponse.json(
        { error: 'childId parameter required' },
        { status: 400 }
      )
    }
    
    const { data: child, error } = await supabase
      .from('children')
      .select('id, parent_id')
      .eq('id', childId)
      .eq('parent_id', user.id)
      .single()
    
    if (error || !child) {
      return NextResponse.json(
        { error: 'Child not found or does not belong to you' },
        { status: 404 }
      )
    }
    
    const encryptedState = encryptState(childId)
    
    const oauthUrl = buildOAuthUrl(encryptedState)
    
    return NextResponse.redirect(oauthUrl)
    
  } catch (error) {
    console.error('YouTube auth error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    )
  }
}
