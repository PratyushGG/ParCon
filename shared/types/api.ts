export interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface VideoFetchRequest {
  childId: string
  maxResults?: number
  force?: boolean
}

export interface VideoFetchResponse {
  success: boolean
  videosCount: number
  newVideosCount: number
  duplicatesSkipped: number
  queuedForAnalysis: number
}

export interface VideoAnalysisRequest {
  videoId: string
  force?: boolean
}

export interface VideoAnalysisResponse {
  success: boolean
  cached?: boolean
  analysis: {
    decision: 'ALLOW' | 'REVIEW' | 'BLOCK'
    confidence: number
    category: string
    educationalValue: number
    concerns: string[]
    reasoning: string
  }
}

export interface NotificationListRequest {
  limit?: number
  unreadOnly?: boolean
  offset?: number
}
