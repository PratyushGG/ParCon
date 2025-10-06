'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AnalyzePage() {
  const params = useParams()
  const router = useRouter()
  const childId = params.childId as string

  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAnalyze(limit: number) {
    setAnalyzing(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/videos/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          childId,
          limit,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed')
      }

      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Analyze Videos with AI</CardTitle>
          <CardDescription>
            Use GPT-4o-mini to analyze video content and determine appropriateness
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!result && !analyzing && (
            <div className="space-y-4">
              <p className="text-gray-600">
                This will analyze unanalyzed videos using AI to determine if they're appropriate for your child.
              </p>
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">What the AI checks:</p>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Child's age and maturity level</li>
                  <li>Your allowed and blocked topics</li>
                  <li>Educational value of content</li>
                  <li>Inappropriate language, violence, or themes</li>
                  <li>Video title, description, and transcript</li>
                </ul>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="text-sm font-medium text-yellow-900 mb-2">💰 Cost:</p>
                <p className="text-sm text-yellow-800">
                  ~$0.0004 per video with GPT-4o-mini (extremely cheap!)
                </p>
              </div>
              <div className="space-y-2">
                <Button onClick={() => handleAnalyze(10)} className="w-full" size="lg">
                  Analyze 10 Videos (Test)
                </Button>
                <Button onClick={() => handleAnalyze(48)} variant="outline" className="w-full">
                  Analyze All Videos
                </Button>
                <Button
                  onClick={() => router.push('/dashboard')}
                  variant="outline"
                  className="w-full"
                >
                  Back to Dashboard
                </Button>
              </div>
            </div>
          )}

          {analyzing && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
              <p className="text-lg font-medium">Analyzing videos with AI...</p>
              <p className="text-sm text-gray-600 mt-2">
                This may take 30-60 seconds depending on the number of videos
              </p>
            </div>
          )}

          {error && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                <p className="font-medium">Error:</p>
                <p>{error}</p>
              </div>
              <Button onClick={() => setError(null)} variant="outline" className="w-full">
                Try Again
              </Button>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <p className="font-medium text-green-900 mb-2">✅ Analysis Complete!</p>
                <div className="text-sm text-green-800 space-y-1">
                  <p>• Videos analyzed: {result.videosAnalyzed}</p>
                  <p>• Videos failed: {result.videosFailed}</p>
                  <p>• Total processed: {result.totalVideos}</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm text-blue-900">
                  AI has categorized each video as ALLOW, REVIEW, or BLOCK based on your preferences.
                  Next, we'll build a dashboard to view the results!
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => router.push('/dashboard')} className="flex-1">
                  Go to Dashboard
                </Button>
                <Button onClick={() => setResult(null)} variant="outline" className="flex-1">
                  Analyze More
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
