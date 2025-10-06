import { getYouTubeClient, refreshAccessToken } from './oauth'
import { createClient } from '@/lib/supabase/server'

/**
 * Fetch watch history for a child's YouTube account
 * Returns array of video IDs with watch timestamps
 */
export async function fetchWatchHistory(
  childId: string,
  maxResults: number = 50
) {
  const supabase = await createClient()

  // Get child's tokens from database
  const { data: child, error } = await supabase
    .from('children')
    .select('youtube_access_token, youtube_refresh_token, token_expires_at')
    .eq('id', childId)
    .single()

  if (error || !child) {
    throw new Error('Child not found or no YouTube connection')
  }

  let accessToken = child.youtube_access_token

  // Check if token is expired and refresh if needed
  const expiresAt = new Date(child.token_expires_at)
  const now = new Date()

  if (now >= expiresAt) {
    // Token expired, refresh it
    const newTokens = await refreshAccessToken(child.youtube_refresh_token)
    accessToken = newTokens.access_token

    // Update tokens in database
    await supabase
      .from('children')
      .update({
        youtube_access_token: newTokens.access_token,
        token_expires_at: newTokens.expiry_date
          ? new Date(newTokens.expiry_date).toISOString()
          : new Date(Date.now() + 3600 * 1000).toISOString(),
      })
      .eq('id', childId)
  }

  // Create authenticated YouTube client
  const youtube = getYouTubeClient(accessToken!)

  try {
    // Try to get watch history from the "HL" playlist (History List)
    console.log('Attempting to fetch watch history from HL playlist...')
    const historyResponse = await youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId: 'HL', // Special playlist ID for watch history
      maxResults: Math.min(maxResults, 50),
    })

    console.log('YouTube History API Response:', {
      itemCount: historyResponse.data.items?.length || 0,
      pageInfo: historyResponse.data.pageInfo,
    })

    // If we got watch history, use it (includes addedAt timestamp)
    if (historyResponse.data.items && historyResponse.data.items.length > 0) {
      const videos = historyResponse.data.items.map((item) => ({
        videoId: item.contentDetails?.videoId || '',
        watchedAt: item.snippet?.publishedAt || new Date().toISOString(), // When added to history
        title: item.snippet?.title || '',
        channelName: item.snippet?.channelTitle || '',
        channelId: item.snippet?.channelId || '',
        thumbnail: item.snippet?.thumbnails?.medium?.url || '',
      }))

      console.log(`Found ${videos.length} videos in watch history`)
      return videos
    }

    // Fallback: Try using the myRating endpoint to get liked videos
    console.log('No watch history available, falling back to liked videos...')
    const response = await youtube.videos.list({
      part: ['snippet', 'contentDetails'],
      myRating: 'like',
      maxResults: Math.min(maxResults, 50),
    })

    console.log('YouTube Liked Videos API Response:', {
      itemCount: response.data.items?.length || 0,
      pageInfo: response.data.pageInfo,
    })

    // If no liked videos, try getting the user's channel and uploaded videos instead
    if (!response.data.items || response.data.items.length === 0) {
      console.log('No liked videos, trying to get channel uploads...')

      // Get user's channel
      const channelResponse = await youtube.channels.list({
        part: ['contentDetails'],
        mine: true,
      })

      const uploadsPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads

      if (uploadsPlaylistId) {
        // Get videos from uploads playlist (their own videos)
        const uploadsResponse = await youtube.playlistItems.list({
          part: ['snippet', 'contentDetails'],
          playlistId: uploadsPlaylistId,
          maxResults: Math.min(maxResults, 50),
        })

        const videos = uploadsResponse.data.items?.map((item) => ({
          videoId: item.contentDetails?.videoId || '',
          watchedAt: item.snippet?.publishedAt || new Date().toISOString(),
          title: item.snippet?.title || '',
          channelName: item.snippet?.channelTitle || '',
          channelId: item.snippet?.channelId || '',
          thumbnail: item.snippet?.thumbnails?.medium?.url || '',
        })) || []

        console.log(`Found ${videos.length} uploaded videos`)
        return videos
      }
    }

    const videos = response.data.items?.map((item) => ({
      videoId: item.id || '',
      watchedAt: item.snippet?.publishedAt || new Date().toISOString(),
      title: item.snippet?.title || '',
      channelName: item.snippet?.channelTitle || '',
      channelId: item.snippet?.channelId || '',
      thumbnail: item.snippet?.thumbnails?.medium?.url || '',
    })) || []

    console.log(`Found ${videos.length} videos from myRating`)
    return videos
  } catch (error: any) {
    console.error('Error fetching watch history:', error)
    console.error('Error details:', error.response?.data || error.message)

    // Check if error is due to invalid token
    if (error.code === 401) {
      throw new Error('YouTube authentication expired. Please reconnect.')
    }

    throw new Error(`Failed to fetch watch history: ${error.message}`)
  }
}

/**
 * Fetch detailed metadata for multiple videos (batch request)
 * More efficient than fetching one at a time
 */
export async function fetchVideoMetadata(
  videoIds: string[],
  accessToken: string
) {
  const youtube = getYouTubeClient(accessToken)

  // YouTube API allows up to 50 videos per request
  const batches = []
  for (let i = 0; i < videoIds.length; i += 50) {
    batches.push(videoIds.slice(i, i + 50))
  }

  const allVideos = []

  for (const batch of batches) {
    try {
      const response = await youtube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: batch,
      })

      const videos = response.data.items?.map((item) => ({
        videoId: item.id || '',
        title: item.snippet?.title || '',
        description: item.snippet?.description || '',
        channelName: item.snippet?.channelTitle || '',
        channelId: item.snippet?.channelId || '',
        thumbnail: item.snippet?.thumbnails?.medium?.url || '',
        duration: parseDuration(item.contentDetails?.duration || ''),
        publishedAt: item.snippet?.publishedAt || '',
        tags: item.snippet?.tags || [],
        categoryId: item.snippet?.categoryId || '',
      })) || []

      allVideos.push(...videos)
    } catch (error) {
      console.error('Error fetching video metadata batch:', error)
      // Continue with other batches even if one fails
    }
  }

  return allVideos
}

/**
 * Parse YouTube duration format (PT15M33S) to seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)

  if (!match) return 0

  const hours = (match[1] || '').replace('H', '')
  const minutes = (match[2] || '').replace('M', '')
  const seconds = (match[3] || '').replace('S', '')

  return (
    (parseInt(hours) || 0) * 3600 +
    (parseInt(minutes) || 0) * 60 +
    (parseInt(seconds) || 0)
  )
}
