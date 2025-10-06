# PRD-03: AI Video Content Analysis

## Overview
Analyze YouTube videos using AI (Claude or OpenAI) to determine if content is appropriate for a child based on parent-defined preferences. Generate decisions (ALLOW/REVIEW/BLOCK) with reasoning.

## User Flow
1. Videos fetched from YouTube watch history
2. System attempts to get video transcript
3. AI analyzes: transcript + metadata + parent preferences
4. AI generates decision: ALLOW, REVIEW, or BLOCK
5. AI provides confidence score, category, educational value, concerns, and reasoning
6. Results stored in database
7. Parent notified if any videos marked as REVIEW
8. Parent can see analysis in dashboard

## Analysis Input Data

### Video Data
- Title
- Channel name
- Description (first 500 chars)
- Transcript (if available)
- Duration
- Thumbnail (future: visual analysis)

### Parent Preferences
- Child's age
- Allowed topics (e.g., ["Education", "Science", "Coding"])
- Blocked topics (e.g., ["Drama", "Pranks", "Violence"])
- Allow mild language: true/false
- Educational priority: high/medium/low

### Context Data
- Channel trust score (if available)
- Previous videos from same channel

---

## Technical Requirements

### AI Providers

**Primary**: Anthropic Claude (claude-3-5-sonnet-20241022)
- Better at nuanced analysis
- Strong reasoning capabilities
- Structured outputs

**Fallback**: OpenAI (gpt-4o-mini)
- Cost-effective
- Fast response times
- Good quality

---

### API Endpoints to Create

#### 1. `/api/analyze/video/route.ts` (POST)

**Purpose**: Analyze a single video

**Request**:
```json
{
  "videoId": "uuid",
  "force": false
}
```

**Logic**:

1. **Fetch Video from Database**
   ```typescript
   const { data: video } = await supabase
     .from('videos')
     .select(`
       *,
       children!inner(
         id,
         name,
         age,
         parent_id,
         parents!inner(
           id,
           parent_preferences(*)
         )
       )
     `)
     .eq('id', videoId)
     .single()
   ```

2. **Check if Already Analyzed**
   ```typescript
   if (video.ai_decision && !force) {
     return { 
       success: true, 
       cached: true, 
       decision: video.ai_decision 
     }
   }
   ```

3. **Fetch Transcript**
   ```typescript
   let transcript = ''
   
   try {
     transcript = await fetchTranscript(video.youtube_video_id)
     
     await supabase
       .from('videos')
       .update({ has_transcript: true })
       .eq('id', videoId)
   } catch (error) {
     await supabase
       .from('videos')
       .update({ 
         has_transcript: false,
         transcript_fetch_failed: true 
       })
       .eq('id', videoId)
   }
   ```

4. **Build AI Prompt**
   ```typescript
   const prompt = buildAnalysisPrompt({
     title: video.title,
     channelName: video.channel_name,
     description: video.description,
     transcript: transcript,
     duration: video.duration,
     childAge: video.children.age,
     allowedTopics: preferences.allowed_topics,
     blockedTopics: preferences.blocked_topics,
     allowMildLanguage: preferences.allow_mild_language,
     educationalPriority: preferences.educational_priority,
   })
   ```

5. **Call AI API**
   ```typescript
   const analysis = await analyzeWithAI(prompt, video.children.parent_id)
   ```

6. **Update Database**
   ```typescript
   await supabase
     .from('videos')
     .update({
       ai_decision: analysis.decision,
       ai_confidence: analysis.confidence,
       ai_category: analysis.category,
       educational_value: analysis.educationalValue,
       concerns: analysis.concerns,
       ai_reasoning: analysis.reasoning,
       analyzed_at: new Date().toISOString(),
     })
     .eq('id', videoId)
   ```

7. **Create Notification if REVIEW**
   ```typescript
   if (analysis.decision === 'REVIEW') {
     await createNotification({
       parent_id: video.children.parent_id,
       type: 'video_review',
       title: 'Video Needs Review',
       message: `"${video.title}" requires your attention`,
     })
   }
   ```

8. **Update Usage Stats**
   ```typescript
   await incrementUsageStats(video.children.parent_id, {
     videos_analyzed: 1,
     ai_api_calls: 1,
     ai_tokens_used: analysis.tokensUsed,
   })
   ```

**Response**:
```json
{
  "success": true,
  "analysis": {
    "decision": "ALLOW",
    "confidence": 95,
    "category": "Educational - Science",
    "educationalValue": 9,
    "concerns": [],
    "reasoning": "This video teaches basic physics concepts in an age-appropriate manner..."
  }
}
```

---

#### 2. `/api/analyze/batch/route.ts` (POST)

**Purpose**: Analyze multiple videos (for initial sync or background jobs)

**Request**:
```json
{
  "videoIds": ["uuid1", "uuid2", "uuid3"],
  "childId": "uuid"
}
```

**Logic**:
1. Process videos in batches of 5 (to avoid rate limits)
2. Use Promise.allSettled for parallel processing
3. Continue even if some fail
4. Return summary of successes/failures

**Response**:
```json
{
  "success": true,
  "analyzed": 45,
  "failed": 2,
  "cached": 3,
  "results": {
    "ALLOW": 30,
    "REVIEW": 10,
    "BLOCK": 5
  }
}
```

---

### Service Layer

#### `/lib/services/ai/analyzer.ts`

```typescript
export interface VideoAnalysis {
  decision: 'ALLOW' | 'REVIEW' | 'BLOCK'
  confidence: number // 0-100
  category: string // e.g., "Educational - Science"
  educationalValue: number // 0-10
  concerns: string[] // e.g., ["Mild language at 2:15"]
  reasoning: string
  tokensUsed: number
}

export async function analyzeWithAI(
  prompt: string,
  parentId: string
): Promise<VideoAnalysis> {
  try {
    return await analyzeWithClaude(prompt)
  } catch (error) {
    console.error('Claude failed, falling back to OpenAI:', error)
    return await analyzeWithOpenAI(prompt)
  }
}

async function analyzeWithClaude(prompt: string): Promise<VideoAnalysis> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })
  
  const data = await response.json()
  
  return parseAIResponse(data.content[0].text, data.usage.total_tokens)
}

async function analyzeWithOpenAI(prompt: string): Promise<VideoAnalysis> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that analyzes YouTube videos for child safety.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
    }),
  })
  
  const data = await response.json()
  
  return parseAIResponse(data.choices[0].message.content, data.usage.total_tokens)
}

function parseAIResponse(text: string, tokensUsed: number): VideoAnalysis {
  const json = JSON.parse(text)
  
  return {
    decision: json.decision,
    confidence: json.confidence,
    category: json.category,
    educationalValue: json.educational_value,
    concerns: json.concerns || [],
    reasoning: json.reasoning,
    tokensUsed,
  }
}
```

---

#### `/lib/services/ai/prompts.ts`

```typescript
interface PromptParams {
  title: string
  channelName: string
  description: string
  transcript: string
  duration: number
  childAge: number
  allowedTopics: string[]
  blockedTopics: string[]
  allowMildLanguage: boolean
  educationalPriority: 'high' | 'medium' | 'low'
}

export function buildAnalysisPrompt(params: PromptParams): string {
  return `You are analyzing a YouTube video to determine if it's appropriate for a ${params.childAge}-year-old child.

**Video Information:**
- Title: ${params.title}
- Channel: ${params.channelName}
- Duration: ${formatDuration(params.duration)}
- Description: ${params.description.slice(0, 500)}
${params.transcript ? `- Transcript: ${params.transcript.slice(0, 2000)}` : '- Transcript: Not available'}

**Parent Preferences:**
- Child Age: ${params.childAge}
- Allowed Topics: ${params.allowedTopics.join(', ') || 'None specified'}
- Blocked Topics: ${params.blockedTopics.join(', ') || 'None specified'}
- Allow Mild Language: ${params.allowMildLanguage ? 'Yes' : 'No'}
- Educational Priority: ${params.educationalPriority}

**Instructions:**
Analyze this video and respond with a JSON object with the following structure:

{
  "decision": "ALLOW" | "REVIEW" | "BLOCK",
  "confidence": <number 0-100>,
  "category": "<video category>",
  "educational_value": <number 0-10>,
  "concerns": ["concern1", "concern2"],
  "reasoning": "<detailed explanation>"
}

**Decision Criteria:**
- ALLOW: Safe, age-appropriate, aligns with preferences
- REVIEW: Borderline content, needs parent judgment (e.g., mildly mature themes, unclear context)
- BLOCK: Inappropriate, contains blocked topics, or violates preferences

**Factors to Consider:**
1. Age appropriateness for ${params.childAge}-year-old
2. Presence of blocked topics: ${params.blockedTopics.join(', ') || 'None'}
3. Educational value (higher priority = ${params.educationalPriority})
4. Language appropriateness (mild language ${params.allowMildLanguage ? 'allowed' : 'not allowed'})
5. Violence, inappropriate behavior, mature themes
6. Clickbait or misleading content

Provide your analysis as a JSON object:`
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}
```

---

### Transcript Fetching

#### `/lib/services/youtube/transcript.ts`

```typescript
export async function fetchTranscript(videoId: string): Promise<string> {
  try {
    const response = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`
    )
    
    const html = await response.text()
    
    const captionTracks = extractCaptionTracks(html)
    
    if (captionTracks.length === 0) {
      throw new Error('No captions available')
    }
    
    const englishTrack = captionTracks.find(t => t.languageCode === 'en') || captionTracks[0]
    
    const transcript = await fetchCaptionTrack(englishTrack.baseUrl)
    
    return transcript
  } catch (error) {
    throw new TranscriptNotAvailableError(videoId)
  }
}

function extractCaptionTracks(html: string): CaptionTrack[] {
  const regex = /"captionTracks":(\[.*?\])/
  const match = html.match(regex)
  
  if (!match) return []
  
  return JSON.parse(match[1])
}

async function fetchCaptionTrack(url: string): Promise<string> {
  const response = await fetch(url)
  const xml = await response.text()
  
  const textRegex = /<text[^>]*>(.*?)<\/text>/g
  const texts = []
  
  let match
  while ((match = textRegex.exec(xml)) !== null) {
    const text = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
    
    texts.push(text)
  }
  
  return texts.join(' ')
}

export class TranscriptNotAvailableError extends Error {
  constructor(videoId: string) {
    super(`Transcript not available for video: ${videoId}`)
  }
}
```

**Alternative**: Use npm package `youtube-transcript` for easier implementation

---

### Database Updates

```typescript
await supabase
  .from('videos')
  .update({
    ai_decision: 'ALLOW',
    ai_confidence: 95,
    ai_category: 'Educational - Science',
    educational_value: 9,
    concerns: [],
    ai_reasoning: 'This video...',
    analyzed_at: new Date().toISOString(),
  })
  .eq('id', videoId)
```

---

### Cost Management

#### Token Usage Tracking
```typescript
await supabase
  .from('usage_stats')
  .upsert({
    parent_id: parentId,
    date: new Date().toISOString().split('T')[0],
    ai_api_calls: 1,
    ai_tokens_used: tokensUsed,
  }, {
    onConflict: 'parent_id,date',
  })
```

#### Estimated Costs
- Claude 3.5 Sonnet: ~$0.003 per video (with transcript)
- GPT-4o-mini: ~$0.0002 per video
- **For 50 videos**: $0.15 (Claude) or $0.01 (GPT-4o-mini)

---

### Error Handling

1. **No Transcript Available**: Analyze based on title + description only
2. **AI API Down**: Queue for retry, use fallback provider
3. **Rate Limit**: Exponential backoff, switch to fallback
4. **Invalid Response**: Log error, mark as needs manual review
5. **Timeout**: Retry up to 3 times with increasing timeout

---

### Environment Variables

```env
# AI Providers
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx

# Optional: Custom prompts
AI_SYSTEM_PROMPT_OVERRIDE=
```

---

### Testing Checklist

- [ ] Analysis works with transcript
- [ ] Analysis works without transcript (fallback to title/desc)
- [ ] All three decisions (ALLOW/REVIEW/BLOCK) can be generated
- [ ] Confidence scores are reasonable (0-100)
- [ ] Educational value scoring works
- [ ] Concerns array populated correctly
- [ ] Parent preferences influence decision
- [ ] Child age affects analysis
- [ ] Batch analysis handles failures gracefully
- [ ] Token usage tracked accurately
- [ ] Fallback to OpenAI works when Claude fails
- [ ] Notifications created for REVIEW videos
- [ ] Cached results returned when force=false

---

### Success Metrics

- Analysis completion rate > 95%
- Average analysis time < 10 seconds
- Parent satisfaction with decisions > 85%
- False positive rate (incorrect BLOCK) < 5%
- False negative rate (missed inappropriate content) < 2%

---

### Future Enhancements

1. **Visual Analysis**: Analyze thumbnails and video frames
2. **Multi-language Support**: Translate transcripts to English
3. **Sentiment Analysis**: Detect toxic comments/behavior
4. **Age-specific Models**: Different prompts for different age groups
5. **Learning System**: Improve based on parent overrides
6. **Channel Reputation**: Use channel history in analysis
7. **Community Guidelines**: Check against YouTube's own classifications
8. **Comparative Analysis**: Compare to similar videos
