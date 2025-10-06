import { google } from 'googleapis'

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  process.env.YOUTUBE_REDIRECT_URI
)

/**
 * Generate the OAuth URL for YouTube authorization
 */
export function getAuthUrl(state: string) {
  const scopes = [
    'https://www.googleapis.com/auth/youtube.readonly',
  ]

  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Important: Get refresh token
    scope: scopes,
    state, // Pass child ID to maintain context
    prompt: 'consent', // Force consent to ensure we get refresh token
  })
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(code: string) {
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string) {
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  })

  const { credentials } = await oauth2Client.refreshAccessToken()
  return credentials
}

/**
 * Create an authenticated YouTube client
 */
export function getYouTubeClient(accessToken: string) {
  const client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  )

  client.setCredentials({
    access_token: accessToken,
  })

  return google.youtube({
    version: 'v3',
    auth: client,
  })
}
