import { YoutubeTranscript } from 'youtube-transcript'

/**
 * Fetch transcript for a YouTube video
 * Returns transcript text or null if unavailable
 *
 * Note: Success rate is approximately 70% of videos
 * Some videos don't have transcripts, or have them disabled
 */
export async function fetchVideoTranscript(videoId: string): Promise<{
  transcript: string | null
  fetchFailed: boolean
}> {
  try {
    const transcriptData = await YoutubeTranscript.fetchTranscript(videoId)

    if (!transcriptData || transcriptData.length === 0) {
      return {
        transcript: null,
        fetchFailed: true,
      }
    }

    // Combine all transcript segments into single text
    const fullTranscript = transcriptData
      .map((segment) => segment.text)
      .join(' ')
      .trim()

    return {
      transcript: fullTranscript,
      fetchFailed: false,
    }
  } catch (error: any) {
    console.error(`Transcript fetch failed for video ${videoId}:`, error.message)

    // Mark as failed so we don't retry
    return {
      transcript: null,
      fetchFailed: true,
    }
  }
}

/**
 * Fetch transcripts for multiple videos
 * Returns a map of videoId -> transcript
 */
export async function fetchMultipleTranscripts(
  videoIds: string[]
): Promise<Map<string, { transcript: string | null; fetchFailed: boolean }>> {
  const results = new Map()

  // Fetch transcripts sequentially to avoid rate limiting
  // Could be parallelized with Promise.all, but safer to do one at a time
  for (const videoId of videoIds) {
    const result = await fetchVideoTranscript(videoId)
    results.set(videoId, result)

    // Small delay to avoid potential rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return results
}
