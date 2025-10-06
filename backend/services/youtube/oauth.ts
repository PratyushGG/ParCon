import { createClient } from '@/frontend/lib/supabase/server'
import crypto from 'crypto'

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
  token_type: string
}

export interface YouTubeChannel {
  id: string
  snippet: {
    title: string
  }
}

export function buildOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export function encryptState(childId: string): string {
  const algorithm = 'aes-256-cbc'
  const key = crypto.scryptSync(process.env.OAUTH_STATE_SECRET!, 'salt', 32)
  const iv = crypto.randomBytes(16)
  
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(childId, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return `${iv.toString('hex')}:${encrypted}`
}

export function decryptState(encryptedState: string): string {
  try {
    const algorithm = 'aes-256-cbc'
    const key = crypto.scryptSync(process.env.OAUTH_STATE_SECRET!, 'salt', 32)
    
    const [ivHex, encrypted] = encryptedState.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    throw new Error('Invalid state parameter')
  }
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }
  
  return response.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  expires_in: number
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token refresh failed: ${error}`)
  }
  
  return response.json()
}

export async function getYouTubeChannelId(accessToken: string): Promise<string> {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get channel ID: ${error}`)
  }
  
  const data = await response.json()
  
  if (!data.items || data.items.length === 0) {
    throw new Error('No YouTube channel found for this account')
  }
  
  return data.items[0].id
}

export async function getValidAccessToken(childId: string): Promise<string> {
  const supabase = await createClient()
  
  const { data: child, error } = await supabase
    .from('children')
    .select('youtube_access_token, youtube_refresh_token, token_expires_at')
    .eq('id', childId)
    .single()
  
  if (error || !child) {
    throw new Error('Child not found')
  }
  
  if (!child.youtube_access_token || !child.youtube_refresh_token) {
    throw new Error('YouTube not connected')
  }
  
  const expiresAt = new Date(child.token_expires_at)
  const now = new Date()
  
  if (expiresAt > now) {
    return child.youtube_access_token
  }
  
  const { access_token, expires_in } = await refreshAccessToken(
    child.youtube_refresh_token
  )
  
  await supabase
    .from('children')
    .update({
      youtube_access_token: access_token,
      token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
    })
    .eq('id', childId)
  
  return access_token
}

export async function revokeGoogleTokens(accessToken: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
      method: 'POST',
    })
  } catch (error) {
    console.error('Failed to revoke tokens:', error)
  }
}

export class YouTubeOAuthError extends Error {
  constructor(
    message: string,
    public code: string = 'OAUTH_ERROR'
  ) {
    super(message)
    this.name = 'YouTubeOAuthError'
  }
}
