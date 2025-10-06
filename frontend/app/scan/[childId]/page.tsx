'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ScanPage() {
  const params = useParams()
  const router = useRouter()
  const childId = params.childId as string

  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleScan() {
    setScanning(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/videos/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          childId,
          maxResults: 50,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Scan failed')
      }

      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Scan Watch History</CardTitle>
          <CardDescription>
            Fetch and analyze your child's YouTube watch history
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!result && !scanning && (
            <div className="space-y-4">
              <p className="text-gray-600">
                This will fetch the last 50 videos from the watch history and store them in the database.
              </p>
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">What will happen:</p>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Fetch last 50 videos from YouTube</li>
                  <li>Get detailed metadata for each video</li>
                  <li>Try to fetch transcripts (may not be available for all videos)</li>
                  <li>Store everything in the database</li>
                </ul>
              </div>
              <Button onClick={handleScan} className="w-full" size="lg">
                Start Scan
              </Button>
              <Button
                onClick={() => router.push('/dashboard')}
                variant="outline"
                className="w-full"
              >
                Back to Dashboard
              </Button>
            </div>
          )}

          {scanning && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
              <p className="text-lg font-medium">Scanning watch history...</p>
              <p className="text-sm text-gray-600 mt-2">
                This may take 1-2 minutes depending on the number of videos
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
                <p className="font-medium text-green-900 mb-2">✅ Scan Complete!</p>
                <div className="text-sm text-green-800 space-y-1">
                  <p>• Videos processed: {result.videosProcessed}</p>
                  <p>• Videos saved: {result.videosSaved}</p>
                  <p>• Videos skipped: {result.videosSkipped}</p>
                  <p>• Transcripts found: {result.transcriptsFound}</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm text-blue-900">
                  Next step: Videos are now in the database!
                  Next, we'll build the AI analysis to review these videos.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => router.push('/dashboard')} className="flex-1">
                  Go to Dashboard
                </Button>
                <Button onClick={() => setResult(null)} variant="outline" className="flex-1">
                  Scan Again
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
