import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface VideoAnalysisInput {
  title: string
  description: string
  channelName: string
  duration: number
  transcript?: string | null
}

export interface ParentPreferences {
  allowedTopics: string[]
  blockedTopics: string[]
  allowMildLanguage: boolean
  educationalPriority: 'high' | 'medium' | 'low'
}

export interface VideoAnalysisResult {
  decision: 'ALLOW' | 'REVIEW' | 'BLOCK'
  confidence: number // 0-100
  category: string
  educationalValue: number // 0-10
  concerns: string[]
  reasoning: string
}

/**
 * Analyze a YouTube video using GPT-4o-mini
 * Determines if content is appropriate for the child
 */
export async function analyzeVideo(
  video: VideoAnalysisInput,
  childAge: number,
  preferences: ParentPreferences
): Promise<VideoAnalysisResult> {
  const durationMinutes = Math.floor(video.duration / 60)
  const durationSeconds = video.duration % 60

  const prompt = `You are analyzing a YouTube video to determine if it's appropriate for a child.

CHILD PROFILE:
- Age: ${childAge} years old

PARENT PREFERENCES:
- Allowed topics: ${preferences.allowedTopics.join(', ')}
- Blocked topics: ${preferences.blockedTopics.join(', ')}
- Allow mild language in educational content: ${preferences.allowMildLanguage ? 'Yes' : 'No'}
- Educational priority: ${preferences.educationalPriority}

VIDEO INFORMATION:
- Title: ${video.title}
- Channel: ${video.channelName}
- Duration: ${durationMinutes}:${durationSeconds.toString().padStart(2, '0')} (${video.duration} seconds)
- Description: ${video.description.slice(0, 500)}
${video.transcript ? `- Transcript (first 4000 chars): ${video.transcript.slice(0, 4000)}` : '- Transcript: Not available'}

Analyze this video and respond ONLY with valid JSON matching this exact structure:
{
  "decision": "ALLOW" | "REVIEW" | "BLOCK",
  "confidence": 0-100,
  "category": "educational" | "entertainment" | "gaming" | "vlog" | "music" | "other",
  "educationalValue": 0-10,
  "concerns": ["array", "of", "concerns"],
  "reasoning": "Brief explanation (max 100 words)"
}

Decision guidelines:
- ALLOW: Content aligns with preferences and is age-appropriate
- REVIEW: Uncertain or borderline content that parent should review
- BLOCK: Clear violation of preferences or age-inappropriate

Consider:
1. Child's age and maturity
2. Parent's allowed/blocked topics
3. Educational value
4. Language, violence, inappropriate themes
5. Context (educational content may have mild language if allowed)`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a content analysis AI specialized in determining if YouTube videos are appropriate for children. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent analysis
      response_format: { type: 'json_object' }, // Ensures JSON output
    })

    const content = response.choices[0]?.message?.content

    if (!content) {
      throw new Error('No response from AI')
    }

    const analysis = JSON.parse(content) as VideoAnalysisResult

    // Validate the response
    if (!analysis.decision || !['ALLOW', 'REVIEW', 'BLOCK'].includes(analysis.decision)) {
      throw new Error('Invalid decision in AI response')
    }

    return analysis
  } catch (error: any) {
    console.error('AI analysis error:', error)

    // Return safe default: mark for review
    return {
      decision: 'REVIEW',
      confidence: 0,
      category: 'other',
      educationalValue: 5,
      concerns: ['ai_analysis_failed'],
      reasoning: 'AI analysis failed - manual review needed',
    }
  }
}

/**
 * Format duration for display
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${seconds} seconds (${mins}:${secs.toString().padStart(2, '0')})`
}
